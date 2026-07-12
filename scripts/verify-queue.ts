import "dotenv/config";

async function main() {
  const base = "https://job-agent-mu-steel.vercel.app";
  const secret = process.env.CRON_SECRET!;

  const healthBefore = await fetch(`${base}/api/health`).then((r) => r.json());
  console.log("QUEUE_BEFORE", healthBefore.queue);

  const workerRes = await fetch(`${base}/api/jobs/worker`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source: "phase15-verify" }),
  });
  console.log("WORKER", workerRes.status, await workerRes.json());

  const healthAfter = await fetch(`${base}/api/health`).then((r) => r.json());
  console.log("QUEUE_AFTER", healthAfter.queue);
}

main().catch(console.error);
