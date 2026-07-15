import { describe, expect, it } from "vitest";
import {
  isDuplicateActiveDelivery,
  isTerminalBrowserTask,
  staleTaskRecoveryStatus,
} from "./queue-policy";

describe("browser task delivery policy", () => {
  it("deduplicates only the same user's active application delivery", () => {
    expect(
      isDuplicateActiveDelivery({
        sameUser: true,
        sameApplication: true,
        sameType: true,
        status: "running",
      })
    ).toBe(true);
    expect(
      isDuplicateActiveDelivery({
        sameUser: false,
        sameApplication: true,
        sameType: true,
        status: "running",
      })
    ).toBe(false);
    expect(
      isDuplicateActiveDelivery({
        sameUser: true,
        sameApplication: true,
        sameType: true,
        status: "completed",
      })
    ).toBe(false);
  });

  it("recovers timed-out work until max attempts, then dead-letters", () => {
    expect(staleTaskRecoveryStatus({ attempts: 1, maxAttempts: 3 })).toBe(
      "pending"
    );
    expect(staleTaskRecoveryStatus({ attempts: 3, maxAttempts: 3 })).toBe(
      "dead_letter"
    );
  });

  it("does not replay terminal deliveries", () => {
    expect(isTerminalBrowserTask("completed")).toBe(true);
    expect(isTerminalBrowserTask("cancelled")).toBe(true);
    expect(isTerminalBrowserTask("dead_letter")).toBe(true);
    expect(isTerminalBrowserTask("running")).toBe(false);
  });
});
