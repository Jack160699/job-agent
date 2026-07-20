import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestWorkerDispatch } from "./worker-dispatch";

describe("requestWorkerDispatch", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://kairela.test/");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("waits for and reports the worker acceptance response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accepted: true }), { status: 202 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestWorkerDispatch("job-123")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://kairela.test/api/jobs/worker",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-cron-secret",
        }),
        body: JSON.stringify({ source: "enqueue", jobId: "job-123" }),
      })
    );
  });

  it("reports a rejected worker response instead of treating it as accepted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 }))
    );

    await expect(requestWorkerDispatch("job-456")).resolves.toBe(false);
  });

  it("reports unavailable dispatch when no cron secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestWorkerDispatch("job-789")).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
