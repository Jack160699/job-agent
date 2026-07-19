import { randomUUID } from "node:crypto";
import {
  createConfirmedUser,
  deleteUserByEmail,
} from "./helpers/auth";

/**
 * Provision one short-lived authenticated account for the serial production
 * smoke run. Environment mutations made by global setup are inherited by the
 * Playwright workers, while the returned callback is guaranteed to run as the
 * suite teardown.
 */
export default async function globalSetup() {
  const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email = `qa.smoke.${runId}@jobagent-e2e.test`;
  const password = `Qa_${randomUUID()}_${randomUUID().slice(0, 8)}!`;

  const authUser = await createConfirmedUser({
    email,
    password,
    fullName: "Kairela Production Smoke",
  });

  try {
    const { prisma } = await import("../src/lib/db");
    const completedAt = new Date();
    await prisma.user.create({
      data: {
        supabaseId: authUser.id,
        email,
        fullName: "Kairela Production Smoke",
        currentLocation: "Bengaluru, Karnataka, India",
        settings: {
          create: {
            jobTitles: ["Software Engineer"],
            experienceYears: 3,
            workModes: ["REMOTE", "HYBRID"],
            locations: ["Bengaluru, Karnataka, India"],
            requiredSkills: ["TypeScript", "React"],
            preferredSkills: [],
            companySizes: [],
            employmentTypes: ["FULL_TIME"],
            autoSubmitSources: [],
            enabledSources: ["GREENHOUSE", "LEVER", "ASHBY", "WORKDAY"],
            preferencesComplete: true,
            onboardingCompletedAt: completedAt,
          },
        },
        onboardingState: {
          create: {
            currentStep: "complete",
            completedSteps: [
              "welcome",
              "resume",
              "review",
              "preferences",
              "complete",
            ],
            isComplete: true,
            completionPct: 100,
            completedAt,
          },
        },
      },
    });
  } catch (error) {
    await deleteUserByEmail(email);
    throw error;
  }

  process.env.E2E_TEST_EMAIL = email;
  process.env.E2E_TEST_PASSWORD = password;
  process.env.E2E_TEST_PROVISIONED = "true";

  return async () => {
    await deleteUserByEmail(email);
  };
}
