import "dotenv/config";
import prisma from "../src/lib/db";
import {
  enqueueInteractiveSearch,
  processBackgroundJobs,
  getQueueStats,
} from "../src/lib/jobs/background";

async function main() {
  const email = "jobagent.test.2026@gmail.com";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Test user not found");

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      jobTitles: ["Software Engineer"],
      requiredSkills: ["JavaScript", "TypeScript"],
      locations: ["Remote"],
      workModes: ["REMOTE"],
      experienceYears: 3,
      matchThreshold: 50,
      preferencesComplete: true,
      targetCompanies: ["stripe", "openai", "linear"],
      enabledSources: ["GREENHOUSE", "LEVER", "ASHBY"],
    },
    update: {
      jobTitles: ["Software Engineer"],
      requiredSkills: ["JavaScript", "TypeScript"],
      locations: ["Remote"],
      workModes: ["REMOTE"],
      experienceYears: 3,
      matchThreshold: 50,
      preferencesComplete: true,
      targetCompanies: ["stripe", "openai", "linear"],
      enabledSources: ["GREENHOUSE", "LEVER", "ASHBY"],
    },
  });

  const before = await getQueueStats();
  console.log("QUEUE_BEFORE", before);

  const t0 = Date.now();
  const { job } = await enqueueInteractiveSearch(user.id);
  console.log("ENQUEUED", job.id, "at", job.queuedAt);

  const tClaim = Date.now();
  await processBackgroundJobs();

  const finished = await prisma.backgroundJob.findUnique({ where: { id: job.id } });
  const after = await getQueueStats();

  console.log("JOB_RESULT", {
    status: finished?.status,
    stage: finished?.progressStage,
    percent: finished?.progressPercent,
    meta: finished?.progressMeta,
    claimMs: finished?.claimedAt
      ? finished.claimedAt.getTime() - job.queuedAt.getTime()
      : null,
    totalMs: finished?.completedAt
      ? finished.completedAt.getTime() - job.queuedAt.getTime()
      : Date.now() - t0,
    elapsedSinceEnqueue: Date.now() - t0,
    elapsedSinceClaimStart: Date.now() - tClaim,
  });
  console.log("QUEUE_AFTER", after);

  const jobs = await prisma.job.count({
    where: { userId: user.id, status: "ACTIVE", matchScore: { gte: 50 } },
  });
  console.log("RELEVANT_ACTIVE_JOBS", jobs);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
