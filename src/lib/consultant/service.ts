import { generateText, streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import prisma from "@/lib/db";
import { canUseFeature, recordUsage } from "@/lib/entitlements";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { AGENT_SYSTEM_PROMPT, createAgentTools, type AgentToolContext } from "@/lib/agent/tools";
import { buildUserContext, pageSuggestions } from "@/lib/agent/context";

export interface ConsultantContext {
  pathname?: string;
  pageTitle?: string;
  conversationId?: string;
}

export { buildUserContext };

export async function ensureConversation(
  userId: string,
  conversationId?: string
) {
  if (conversationId) {
    const existing = await prisma.consultantConversation.findFirst({
      where: { id: conversationId, userId, archivedAt: null },
    });
    if (existing) return existing;
  }

  return prisma.consultantConversation.create({
    data: { userId, title: "Career chat" },
  });
}

export async function listConversations(userId: string) {
  return prisma.consultantConversation.findMany({
    where: { userId, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      createdAt: true,
    },
  });
}

export async function getConversationMessages(
  userId: string,
  conversationId: string,
  limit = 50
) {
  const conversation = await prisma.consultantConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true, title: true, archivedAt: true },
  });
  if (!conversation) return null;

  const latest = await prisma.consultantMessage.findMany({
    where: { userId, conversationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, role: true, content: true, createdAt: true, metadata: true },
  });

  return {
    conversation,
    messages: latest.reverse(),
  };
}

export async function renameConversation(
  userId: string,
  conversationId: string,
  title: string
) {
  const trimmed = title.trim().slice(0, 80);
  if (!trimmed) throw new Error("Title required");
  const existing = await prisma.consultantConversation.findFirst({
    where: { id: conversationId, userId },
  });
  if (!existing) throw new Error("Conversation not found");
  return prisma.consultantConversation.update({
    where: { id: conversationId },
    data: { title: trimmed },
  });
}

export async function archiveConversation(
  userId: string,
  conversationId: string
) {
  const existing = await prisma.consultantConversation.findFirst({
    where: { id: conversationId, userId },
  });
  if (!existing) throw new Error("Conversation not found");
  return prisma.consultantConversation.update({
    where: { id: conversationId },
    data: { archivedAt: new Date() },
  });
}

async function prepareChat(
  userId: string,
  message: string,
  context: ConsultantContext
) {
  if (!isFeatureEnabled("aiConsultant")) {
    throw new Error("AI consultant is not enabled");
  }

  const gate = await canUseFeature(userId, "ai_consultant");
  if (!gate.allowed) {
    throw new Error(gate.reason || "Usage limit reached");
  }

  const conversation = await ensureConversation(userId, context.conversationId);

  await prisma.consultantMessage.create({
    data: {
      userId,
      conversationId: conversation.id,
      role: "user",
      content: message,
    },
  });

  await prisma.consultantConversation.update({
    where: { id: conversation.id },
    data: {
      updatedAt: new Date(),
      title:
        conversation.title === "Career chat"
          ? message.slice(0, 60)
          : conversation.title,
    },
  });

  const toolCtx: AgentToolContext = {
    userId,
    pathname: context.pathname,
    pageTitle: context.pageTitle,
    conversationId: conversation.id,
  };

  const history = await prisma.consultantMessage.findMany({
    where: { userId, conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const messages = history.reverse().map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  return { gate, toolCtx, messages, conversation };
}

export async function chatWithConsultant(
  userId: string,
  message: string,
  context: ConsultantContext = {}
) {
  const { gate, toolCtx, messages, conversation } = await prepareChat(
    userId,
    message,
    context
  );
  const tools = createAgentTools(toolCtx);
  const pageContext = context.pathname
    ? `\nCurrent page: ${context.pathname}${context.pageTitle ? ` (${context.pageTitle})` : ""}`
    : "";

  const { text, toolCalls } = await generateText({
    model: openai("gpt-4o-mini"),
    system: `${AGENT_SYSTEM_PROMPT}${pageContext}`,
    messages,
    tools,
    maxSteps: 4,
    maxTokens: 1000,
  });

  const recentProposals = await prisma.agentActionProposal.findMany({
    where: {
      userId,
      conversationId: conversation.id,
      status: "PENDING",
      createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const proposals = recentProposals.map((proposal) => ({
    proposalId: proposal.id,
    toolName: proposal.toolName,
    expiresAt: proposal.expiresAt,
    summary:
      proposal.toolName === "start_job_search"
        ? "Start a job search with your saved preferences."
        : "Prepare application documents without submitting.",
  }));

  const assistantMsg = await prisma.consultantMessage.create({
    data: {
      userId,
      conversationId: conversation.id,
      role: "assistant",
      content: text,
      metadata: {
        pathname: context.pathname,
        toolCalls: toolCalls?.length ?? 0,
        proposals,
      },
    },
  });

  await recordUsage(userId, "ai_consultant");

  return {
    message: assistantMsg,
    conversationId: conversation.id,
    remaining: gate.remaining != null ? gate.remaining - 1 : undefined,
    suggestions: pageSuggestions(context.pathname),
    proposals,
  };
}

export async function streamConsultantReply(
  userId: string,
  message: string,
  context: ConsultantContext = {}
) {
  const { gate, toolCtx, messages, conversation } = await prepareChat(
    userId,
    message,
    context
  );
  const tools = createAgentTools(toolCtx);
  const pageContext = context.pathname
    ? `\nCurrent page: ${context.pathname}${context.pageTitle ? ` (${context.pageTitle})` : ""}`
    : "";

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: `${AGENT_SYSTEM_PROMPT}${pageContext}`,
    messages,
    tools,
    maxSteps: 4,
    maxTokens: 1000,
    onFinish: async ({ text }) => {
      await prisma.consultantMessage.create({
        data: {
          userId,
          conversationId: conversation.id,
          role: "assistant",
          content: text,
          metadata: { pathname: context.pathname, streamed: true },
        },
      });
      await recordUsage(userId, "ai_consultant");
    },
  });

  return {
    stream: result,
    remaining: gate.remaining,
    conversationId: conversation.id,
  };
}
