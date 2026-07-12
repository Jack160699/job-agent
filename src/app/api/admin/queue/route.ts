import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { isAdminUser } from "@/lib/auth/admin";
import { recoverStaleJobs } from "@/lib/jobs/background";

export async function GET() {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await recoverStaleJobs();

  const [stats, recent, deadLetter] = await Promise.all([
    prisma.backgroundJob.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    prisma.backgroundJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        status: true,
        priority: true,
        source: true,
        userId: true,
        attempts: true,
        maxAttempts: true,
        error: true,
        progressStage: true,
        progressPercent: true,
        queuedAt: true,
        claimedAt: true,
        startedAt: true,
        completedAt: true,
        failedAt: true,
        cancelledAt: true,
        createdAt: true,
      },
    }),
    prisma.backgroundJob.findMany({
      where: { status: "dead_letter" },
      orderBy: { failedAt: "desc" },
      take: 20,
    }),
  ]);

  const statusMap = Object.fromEntries(
    stats.map((s) => [s.status, s._count.id])
  );

  return NextResponse.json({
    stats: statusMap,
    recent,
    deadLetter,
    recoveredAt: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action as string;
  const jobId = body.jobId as string | undefined;

  if (action === "recover_stale") {
    const count = await recoverStaleJobs();
    return NextResponse.json({ recovered: count });
  }

  if (action === "retry" && jobId) {
    const job = await prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: "pending",
        attempts: 0,
        error: null,
        failedAt: null,
        cancelledAt: null,
        scheduledAt: new Date(),
        claimedAt: null,
        startedAt: null,
        heartbeatAt: null,
      },
    });
    return NextResponse.json({ job });
  }

  if (action === "cancel" && jobId) {
    const job = await prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        error: "Cancelled by admin",
      },
    });
    return NextResponse.json({ job });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
