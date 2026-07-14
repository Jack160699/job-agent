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
}

export { buildUserContext };

async function prepareChat(userId: string, message: string, context: ConsultantContext) {
  if (!isFeatureEnabled("aiConsultant")) {
    throw new Error("AI consultant is not enabled");
  }

  const gate = await canUseFeature(userId, "ai_consultant");
  if (!gate.allowed) {
    throw new Error(gate.reason || "Usage limit reached");
  }

  await prisma.consultantMessage.create({
    data: { userId, role: "user", content: message },
  });

  const toolCtx: AgentToolContext = {
    userId,
    pathname: context.pathname,
    pageTitle: context.pageTitle,
  };

  const history = await prisma.consultantMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const messages = history.reverse().map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  return { gate, toolCtx, messages };
}

export async function chatWithConsultant(
  userId: string,
  message: string,
  context: ConsultantContext = {}
) {
  const { gate, toolCtx, messages } = await prepareChat(userId, message, context);
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

  const assistantMsg = await prisma.consultantMessage.create({
    data: {
      userId,
      role: "assistant",
      content: text,
      metadata: {
        pathname: context.pathname,
        toolCalls: toolCalls?.length ?? 0,
      },
    },
  });

  await recordUsage(userId, "ai_consultant");

  return {
    message: assistantMsg,
    remaining: gate.remaining != null ? gate.remaining - 1 : undefined,
    suggestions: pageSuggestions(context.pathname),
  };
}

export async function streamConsultantReply(
  userId: string,
  message: string,
  context: ConsultantContext = {}
) {
  const { gate, toolCtx, messages } = await prepareChat(userId, message, context);
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
          role: "assistant",
          content: text,
          metadata: { pathname: context.pathname, streamed: true },
        },
      });
      await recordUsage(userId, "ai_consultant");
    },
  });

  return { stream: result, remaining: gate.remaining };
}
