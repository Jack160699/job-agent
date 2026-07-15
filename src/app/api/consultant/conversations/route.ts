import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDbUser } from "@/lib/auth/server";
import {
  archiveConversation,
  ensureConversation,
  getConversationMessages,
  listConversations,
  renameConversation,
} from "@/lib/consultant/service";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";

export async function GET() {
  const user = await getDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await listConversations(user.id);
  return NextResponse.json({
    conversations,
    enabled: isFeatureEnabled("aiConsultant"),
  });
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, {
    ...RATE_LIMIT_PRESETS.aiChat,
    keyPrefix: "consultant-conversations",
  });
  if (limited) return limited;

  const user = await getDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversation = await ensureConversation(user.id);
  return NextResponse.json({ conversation });
}

const patchSchema = z.object({
  conversationId: z.string().uuid(),
  title: z.string().min(1).max(80).optional(),
  archive: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  const user = await getDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    if (parsed.data.archive) {
      const conversation = await archiveConversation(
        user.id,
        parsed.data.conversationId
      );
      return NextResponse.json({ conversation });
    }
    if (parsed.data.title) {
      const conversation = await renameConversation(
        user.id,
        parsed.data.conversationId,
        parsed.data.title
      );
      return NextResponse.json({ conversation });
    }
    const detail = await getConversationMessages(
      user.id,
      parsed.data.conversationId
    );
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json(
      { error: message },
      { status: message.includes("not found") ? 404 : 400 }
    );
  }
}
