export const TERMINAL_BROWSER_TASK_STATUSES = [
  "completed",
  "cancelled",
  "dead_letter",
] as const;

export function isTerminalBrowserTask(status: string) {
  return TERMINAL_BROWSER_TASK_STATUSES.includes(
    status as (typeof TERMINAL_BROWSER_TASK_STATUSES)[number]
  );
}

export function staleTaskRecoveryStatus(input: {
  attempts: number;
  maxAttempts: number;
}) {
  return input.attempts >= input.maxAttempts ? "dead_letter" : "pending";
}

export function isDuplicateActiveDelivery(input: {
  sameUser: boolean;
  sameApplication: boolean;
  sameType: boolean;
  status: string;
}) {
  return (
    input.sameUser &&
    input.sameApplication &&
    input.sameType &&
    ["pending", "running"].includes(input.status)
  );
}
