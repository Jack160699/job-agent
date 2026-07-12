import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { resolveApiUserDev } from "@/lib/api/auth";
import { runAutonomousAgent } from "@/lib/agent/orchestrator";

export async function POST(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;

  try {
    const user = await resolveApiUserDev();
    const result = await runAutonomousAgent(user.id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent run failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
