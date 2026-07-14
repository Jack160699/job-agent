import { describe, expect, it } from "vitest";
import {
  isConfirmableAgentTool,
  normalizeProposalParams,
  proposalFingerprint,
} from "./action-proposals";

describe("agent action proposals", () => {
  it("only allows low-risk confirmable tools", () => {
    expect(isConfirmableAgentTool("start_job_search")).toBe(true);
    expect(isConfirmableAgentTool("prepare_application")).toBe(true);
    expect(isConfirmableAgentTool("submit_application")).toBe(false);
  });

  it("forces prepare_application to stay non-submitting", () => {
    expect(
      normalizeProposalParams("prepare_application", {
        applicationId: "app-1",
        autoSubmit: true,
        confirmed: true,
      })
    ).toEqual({ applicationId: "app-1", autoSubmit: false });
  });

  it("fingerprints normalized parameters stably", () => {
    const a = proposalFingerprint("start_job_search", { async: true });
    const b = proposalFingerprint("start_job_search", { async: true });
    expect(a).toBe(b);
  });
});
