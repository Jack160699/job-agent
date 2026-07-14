import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { resolveApiUser } from "@/lib/api/auth";
import { runAutonomousAgent } from "@/lib/agent/orchestrator";
import { enqueueJob } from "@/lib/jobs/background";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.aiChat);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const asyncMode =
      request.nextUrl.searchParams.get("async") === "true" ||
      request.headers.get("x-async-agent") === "true";

    if (asyncMode) {
      await enqueueJob("RUN_AGENT", { userId: user.id });
      return NextResponse.json({ queued: true, status: "pending" });
    }

    const result = await Promise.race([
      runAutonomousAgent(user.id),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Agent timed out")), 45000)
      ),
    ]);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent run failed";
    if (message === "Agent timed out") {
      const user = await resolveApiUser().catch(() => null);
      if (user) await enqueueJob("RUN_AGENT", { userId: user.id });
      return NextResponse.json({ queued: true, status: "pending", message });
    }
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
