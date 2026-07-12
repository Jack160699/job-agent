const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  try {
    const user = await p.user.create({
      data: {
        supabaseId: "f18280df-7557-432f-b23d-b8e2670b046b",
        email: "jobagent.test.2026@gmail.com",
        fullName: "Test User",
        settings: {
          create: {
            jobTitles: ["Software Engineer"],
            locations: ["Remote"],
            enabledSources: ["LINKEDIN", "INDEED", "GREENHOUSE", "LEVER", "ASHBY"],
          },
        },
      },
    });
    console.log("Created:", user.id);
  } catch (e) {
    console.error("Error:", e.message);
  }
}

main().finally(() => p.$disconnect());
