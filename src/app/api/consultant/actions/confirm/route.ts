import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDbUser } from "@/lib/auth/server";
import { confirmActionProposal } from "@/lib/agent/action-proposals";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { createAuditLog } from "@/lib/audit";
import { EntitlementError } from "@/lib/entitlements";

const schema = z.object({
  proposalId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, {
    ...RATE_LIMIT_PRESETS.aiChat,
    keyPrefix: "consultant-confirm",
  });
  if (limited) return limited;

  const user = await getDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid proposal" }, { status: 400 });
  }

  try {
    const result = await confirmActionProposal({
      userId: user.id,
      proposalId: parsed.data.proposalId,
    });

    await createAuditLog({
      userId: user.id,
      action: "AGENT_ACTION_CONFIRMED",
      resource: "agent_action_proposal",
      resourceId: parsed.data.proposalId,
      message: `Confirmed ${result.proposal.toolName}`,
      level: "AUDIT",
      metadata: result.result,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof EntitlementError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          feature: error.feature,
          remaining: error.remaining,
        },
        { status: 402 }
      );
    }
    const message = error instanceof Error ? error.message : "Confirm failed";
    return NextResponse.json(
      { error: message },
      {
        status:
          message.includes("not found")
            ? 404
            : message.includes("expired") || message.includes("PENDING")
              ? 409
              : 400,
      }
    );
  }
}
