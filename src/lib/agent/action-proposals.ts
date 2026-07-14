import { createHash } from "crypto";
import prisma from "@/lib/db";
import { enqueueInteractiveSearch } from "@/lib/jobs/background";
import { processApplication } from "@/lib/jobs/pipeline";
import type { Prisma } from "@prisma/client";

export const CONFIRMABLE_AGENT_TOOLS = [
  "start_job_search",
  "prepare_application",
] as const;

export type ConfirmableAgentTool = (typeof CONFIRMABLE_AGENT_TOOLS)[number];

export function isConfirmableAgentTool(
  value: string
): value is ConfirmableAgentTool {
  return (CONFIRMABLE_AGENT_TOOLS as readonly string[]).includes(value);
}

export function normalizeProposalParams(
  toolName: ConfirmableAgentTool,
  params: Record<string, unknown>
): Record<string, unknown> {
  if (toolName === "start_job_search") {
    return { async: true };
  }
  if (toolName === "prepare_application") {
    const applicationId =
      typeof params.applicationId === "string" ? params.applicationId.trim() : "";
    if (!applicationId) {
      throw new Error("applicationId is required");
    }
    return { applicationId, autoSubmit: false };
  }
  return {};
}

export function proposalFingerprint(
  toolName: ConfirmableAgentTool,
  params: Record<string, unknown>
) {
  return createHash("sha256")
    .update(`${toolName}:${JSON.stringify(params)}`)
    .digest("hex");
}

export async function createActionProposal(input: {
  userId: string;
  conversationId?: string | null;
  toolName: ConfirmableAgentTool;
  params: Record<string, unknown>;
  ttlMinutes?: number;
}) {
  const params = normalizeProposalParams(input.toolName, input.params);
  const expiresAt = new Date(
    Date.now() + (input.ttlMinutes ?? 10) * 60 * 1000
  );

  return prisma.agentActionProposal.create({
    data: {
      userId: input.userId,
      conversationId: input.conversationId || null,
      toolName: input.toolName,
      params: {
        ...params,
        fingerprint: proposalFingerprint(input.toolName, params),
      } as Prisma.InputJsonValue,
      expiresAt,
    },
  });
}

export async function confirmActionProposal(input: {
  userId: string;
  proposalId: string;
}) {
  const proposal = await prisma.agentActionProposal.findFirst({
    where: { id: input.proposalId, userId: input.userId },
  });
  if (!proposal) {
    throw new Error("Proposal not found");
  }
  if (proposal.status !== "PENDING") {
    throw new Error(`Proposal is ${proposal.status.toLowerCase()}`);
  }
  if (proposal.expiresAt.getTime() <= Date.now()) {
    await prisma.agentActionProposal.update({
      where: { id: proposal.id },
      data: { status: "EXPIRED" },
    });
    throw new Error("Proposal expired");
  }
  if (!isConfirmableAgentTool(proposal.toolName)) {
    throw new Error("Unsupported proposal tool");
  }

  const params = proposal.params as Record<string, unknown>;
  const expected = proposalFingerprint(
    proposal.toolName,
    normalizeProposalParams(proposal.toolName, params)
  );
  if (params.fingerprint !== expected) {
    throw new Error("Proposal parameters were tampered with");
  }

  let result: Record<string, unknown>;
  if (proposal.toolName === "start_job_search") {
    const queued = await enqueueInteractiveSearch(input.userId);
    result = {
      queued: true,
      jobId: queued.job.id,
      deduped: queued.deduped,
    };
  } else {
    const applicationId = String(params.applicationId);
    const owned = await prisma.application.findFirst({
      where: { id: applicationId, userId: input.userId },
      select: { id: true },
    });
    if (!owned) throw new Error("Application not found");
    const processed = await processApplication(input.userId, applicationId);
    result = {
      applicationId,
      status: processed.status,
      prepared: true,
      submitted: false,
    };
  }

  const updated = await prisma.agentActionProposal.update({
    where: { id: proposal.id },
    data: {
      status: "EXECUTED",
      consumedAt: new Date(),
      result: result as Prisma.InputJsonValue,
    },
  });

  return { proposal: updated, result };
}
