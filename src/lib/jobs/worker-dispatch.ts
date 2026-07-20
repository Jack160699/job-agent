import { getAppBaseUrl } from "@/lib/brand/urls";

const WORKER_KICK_TIMEOUT_MS = 4000;

function logDispatch(event: string, data: Record<string, unknown> = {}): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      component: "worker-dispatch",
      event,
      ...data,
    })
  );
}

/**
 * Ask the long-running worker route to accept a specific queued job.
 *
 * The worker responds as soon as it registers its background task, so
 * awaiting this function acknowledges the handoff without awaiting the job.
 */
export async function requestWorkerDispatch(jobId: string): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WORKER_KICK_TIMEOUT_MS);

  try {
    const response = await fetch(`${getAppBaseUrl()}/api/jobs/worker`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source: "enqueue", jobId }),
      signal: controller.signal,
    });

    if (!response.ok) {
      logDispatch("worker_dispatch_rejected", {
        jobId,
        status: response.status,
      });
      return false;
    }

    logDispatch("worker_dispatch_accepted", { jobId });
    return true;
  } catch (error) {
    logDispatch("worker_dispatch_failed", {
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
