import { NextRequest, NextResponse } from "next/server";
import { getDbUser } from "@/lib/auth/server";
import { getConversationMessages } from "@/lib/consultant/service";
import { pageSuggestions } from "@/lib/agent/context";
import { isFeatureEnabled } from "@/lib/feature-flags";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const detail = await getConversationMessages(user.id, id);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pathname = request.nextUrl.searchParams.get("pathname") ?? undefined;
  return NextResponse.json({
    ...detail,
    enabled: isFeatureEnabled("aiConsultant"),
    suggestions: pageSuggestions(pathname),
  });
}
