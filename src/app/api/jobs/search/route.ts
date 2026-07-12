import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { searchJobs, getOrCreateUser } from "@/lib/jobs/pipeline";

export async function POST(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let userId: string;

    if (user) {
      const dbUser = await getOrCreateUser(user.id, user.email!);
      userId = dbUser.id;
    } else if (process.env.NODE_ENV === "development") {
      const dbUser = await getOrCreateUser("dev-user", "dev@localhost");
      userId = dbUser.id;
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await searchJobs(userId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 }
    );
  }
}
