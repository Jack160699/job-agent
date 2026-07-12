import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rate-limit";
import {
  analyzeJob,
  matchJob,
  processApplication,
  runFullPipeline,
  getOrCreateUser,
} from "@/lib/jobs/pipeline";

async function getUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const dbUser = await getOrCreateUser(user.id, user.email!);
    return dbUser.id;
  }

  if (process.env.NODE_ENV === "development") {
    const dbUser = await getOrCreateUser("dev-user", "dev@localhost");
    return dbUser.id;
  }

  return null;
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;

  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, jobId, applicationId } = body;

    switch (action) {
      case "analyze":
        if (!jobId) throw new Error("jobId required");
        return NextResponse.json(await analyzeJob(userId, jobId));

      case "match":
        if (!jobId) throw new Error("jobId required");
        return NextResponse.json(await matchJob(userId, jobId));

      case "process":
        if (!applicationId) throw new Error("applicationId required");
        return NextResponse.json(
          await processApplication(userId, applicationId)
        );

      case "pipeline":
        if (!jobId) throw new Error("jobId required");
        return NextResponse.json(await runFullPipeline(userId, jobId));

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 }
    );
  }
}
