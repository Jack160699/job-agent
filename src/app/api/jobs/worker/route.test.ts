import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  claimAndProcessJob: vi.fn(),
  processBackgroundJobs: vi.fn(),
  verifyCronSecret: vi.fn(),
}));

vi.mock("next/server", () => ({
  after: mocks.after,
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

vi.mock("@/lib/security/rate-limit", () => ({
  verifyCronSecret: mocks.verifyCronSecret,
}));

vi.mock("@/lib/jobs/background", () => ({
  claimAndProcessJob: mocks.claimAndProcessJob,
  processBackgroundJobs: mocks.processBackgroundJobs,
}));

import { POST } from "./route";

describe("jobs worker route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyCronSecret.mockReturnValue(true);
    mocks.claimAndProcessJob.mockResolvedValue({
      id: "job-123",
      status: "completed",
    });
  });

  it("acknowledges a targeted job before running it in after()", async () => {
    const request = new Request("https://kairela.test/api/jobs/worker", {
      method: "POST",
      headers: {
        Authorization: "Bearer test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source: "enqueue", jobId: "job-123" }),
    });

    const response = await POST(request as never);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      jobId: "job-123",
    });
    expect(mocks.after).toHaveBeenCalledTimes(1);
    expect(mocks.claimAndProcessJob).not.toHaveBeenCalled();

    const scheduled = mocks.after.mock.calls[0]?.[0] as () => Promise<void>;
    await scheduled();
    expect(mocks.claimAndProcessJob).toHaveBeenCalledWith("job-123");
    expect(mocks.processBackgroundJobs).not.toHaveBeenCalled();
  });

  it("retains synchronous batch-drain behavior when no job id is supplied", async () => {
    mocks.processBackgroundJobs.mockResolvedValue([
      { id: "job-456", status: "completed" },
    ]);
    const request = new Request("https://kairela.test/api/jobs/worker", {
      method: "POST",
      body: JSON.stringify({ source: "manual" }),
    });

    const response = await POST(request as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      processed: 1,
      results: [{ id: "job-456", status: "completed" }],
    });
    expect(mocks.after).not.toHaveBeenCalled();
  });
});
