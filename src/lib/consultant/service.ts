import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import prisma from "@/lib/db";
import { canUseFeature, recordUsage } from "@/lib/entitlements";
import { isFeatureEnabled } from "@/lib/feature-flags";

const SYSTEM_PROMPT = `You are Kairela, an AI career consultant. You help job seekers understand their search progress, preferences, and next steps.

Rules:
- Never invent qualifications, experience, or credentials for the user.
- Never claim guaranteed salary or market outcomes — label estimates clearly.
- Never send messages to recruiters or submit applications without explicit user confirmation.
- Be concise, actionable, and honest about uncertainty.
- Reference only the user context provided.`;

export interface ConsultantContext {
  pathname?: string;
  pageTitle?: string;
}

export async function buildUserContext(userId: string): Promise<string> {
  const [settings, onboarding, jobCount, appCount, lastSearch] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId } }),
    prisma.onboardingState.findUnique({ where: { userId } }),
    prisma.job.count({ where: { userId, status: "ACTIVE" } }),
    prisma.application.count({ where: { userId } }),
    prisma.backgroundJob.findFirst({
      where: { userId, type: "SEARCH_JOBS", status: "completed" },
      orderBy: { completedAt: "desc" },
    }),
  ]);

  const parts = [
    `Preferences complete: ${settings?.preferencesComplete ?? false}`,
    `Job titles: ${settings?.jobTitles?.join(", ") || "not set"}`,
    `Locations: ${settings?.locations?.join(", ") || "not set"}`,
    `Active jobs: ${jobCount}`,
    `Applications: ${appCount}`,
    `Onboarding complete: ${onboarding?.isComplete ?? false}`,
  ];

  if (lastSearch?.completedAt) {
    const meta = lastSearch.progressMeta as { relevant?: number } | null;
    parts.push(
      `Last search: ${lastSearch.completedAt.toISOString()} (${meta?.relevant ?? 0} relevant)`
    );
  }

  return parts.join("\n");
}

export async function chatWithConsultant(
  userId: string,
  message: string,
  context: ConsultantContext = {}
) {
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

  const userContext = await buildUserContext(userId);
  const pageContext = context.pathname
    ? `Current page: ${context.pathname}${context.pageTitle ? ` (${context.pageTitle})` : ""}`
    : "";

  const history = await prisma.consultantMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const conversation = history
    .reverse()
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    system: `${SYSTEM_PROMPT}\n\nUser context:\n${userContext}\n${pageContext}`,
    prompt: conversation ? `${conversation}\nuser: ${message}` : message,
    maxTokens: 800,
  });

  const assistantMsg = await prisma.consultantMessage.create({
    data: {
      userId,
      role: "assistant",
      content: text,
      metadata: { pathname: context.pathname },
    },
  });

  await recordUsage(userId, "ai_consultant");

  return {
    message: assistantMsg,
    remaining: gate.remaining != null ? gate.remaining - 1 : undefined,
  };
}
