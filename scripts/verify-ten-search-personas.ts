import prisma from "../src/lib/db";
import { searchJobs } from "../src/lib/jobs/pipeline";

const runId = `kairela-verification-${Date.now()}`;

const personas = [
  {
    name: "MCA fresher software developer",
    titles: ["Software Developer", "Associate Software Engineer"],
    skills: ["TypeScript", "React", "Node.js"],
    locations: ["Pune", "Bengaluru", "India"],
    experience: 0,
    sector: "PRIVATE",
  },
  {
    name: "Operations and implementation analyst",
    titles: ["Operations Analyst", "Implementation Analyst"],
    skills: ["Operations", "Implementation", "Process improvement"],
    locations: ["Bengaluru", "Hyderabad", "India"],
    experience: 2,
    sector: "PRIVATE",
  },
  {
    name: "AI automation engineer",
    titles: ["AI Engineer", "Automation Engineer"],
    skills: ["Python", "Machine Learning", "Automation"],
    locations: ["Bengaluru", "Remote", "India"],
    experience: 4,
    sector: "PRIVATE",
  },
  {
    name: "B.Tech computer-science fresher",
    titles: ["Graduate Engineer Trainee", "Junior Software Engineer"],
    skills: ["Java", "SQL", "Problem solving"],
    locations: ["Pune", "Hyderabad", "India"],
    experience: 0,
    sector: "PRIVATE",
  },
  {
    name: "General graduate government candidate",
    titles: ["Officer", "Assistant", "Graduate Apprentice"],
    skills: ["Administration", "Aptitude", "Communication"],
    locations: ["India"],
    experience: 0,
    sector: "GOVERNMENT",
  },
  {
    name: "Diploma technician and apprenticeship candidate",
    titles: ["Technician", "Junior Engineer", "Technician Apprentice"],
    skills: ["Diploma", "Maintenance", "Electrical"],
    locations: ["Chennai", "Bengaluru", "India"],
    experience: 0,
    sector: "PRIVATE",
  },
  {
    name: "Banking candidate",
    titles: ["Banking Associate", "Credit Analyst", "Banking Officer"],
    skills: ["Banking", "Finance", "Customer service"],
    locations: ["Mumbai", "Bengaluru", "India"],
    experience: 1,
    sector: "PRIVATE",
  },
  {
    name: "Nursing and healthcare candidate",
    titles: ["Staff Nurse", "Registered Nurse", "Nursing Officer"],
    skills: ["Patient care", "GNM", "Nursing"],
    locations: ["Hyderabad", "Bengaluru", "India"],
    experience: 1,
    sector: "PRIVATE",
  },
  {
    name: "Teacher and education candidate",
    titles: ["Teacher", "Lecturer", "Academic Coordinator"],
    skills: ["Teaching", "Curriculum", "BEd"],
    locations: ["Bengaluru", "Remote", "India"],
    experience: 2,
    sector: "PRIVATE",
  },
  {
    name: "Sales and marketing professional",
    titles: ["Sales Executive", "Marketing Executive", "Business Development Executive"],
    skills: ["Sales", "CRM", "Digital marketing"],
    locations: ["Delhi", "Gurugram", "India"],
    experience: 3,
    sector: "PRIVATE",
  },
] as const;

const requestedPersonaIndex = Number(process.env.PERSONA_INDEX);
const selectedPersonas = Number.isInteger(requestedPersonaIndex)
  ? personas.slice(requestedPersonaIndex, requestedPersonaIndex + 1)
  : personas;

async function main() {
  const createdUserIds: string[] = [];
  const evidence: Array<Record<string, unknown>> = [];
  const uniqueCanonicalJobs = new Set<string>();
  let officialGovernmentJobs = 0;
  try {
    for (const [index, persona] of selectedPersonas.entries()) {
      const user = await prisma.user.create({
        data: {
          email: `${runId}-${index}@example.invalid`,
          fullName: `Verification ${persona.name}`,
          currentLocation: persona.locations[0],
          settings: {
            create: {
              jobTitles: [...persona.titles],
              experienceYears: persona.experience,
              salaryCurrency: "INR",
              workModes: ["ONSITE", "HYBRID", "REMOTE"],
              locations: [...persona.locations],
              requiredSkills: [...persona.skills],
              preferredSkills: [],
              companySizes: [],
              employmentTypes: ["FULL_TIME", "INTERNSHIP"],
              autoSubmitSources: [],
              enabledSources:
                persona.sector === "GOVERNMENT"
                  ? ["UPSC", "ISRO", "NTPC", "DRDO"]
                  : ["GREENHOUSE", "LEVER", "ASHBY", "WORKDAY"],
              matchThreshold: 45,
              sectorPreference: persona.sector,
              governmentCategories:
                persona.sector === "GOVERNMENT"
                  ? ["Engineering", "Banking", "PSU"]
                  : [],
              preferencesComplete: true,
              requireReview: true,
              autoSubmitEnabled: false,
            },
          },
        },
      });
      createdUserIds.push(user.id);

      const result = await searchJobs(user.id);
      const saved = await prisma.job.count({ where: { userId: user.id } });
      const active = await prisma.job.count({
        where: { userId: user.id, status: "ACTIVE" },
      });
      const activeJobs = await prisma.job.findMany({
        where: { userId: user.id, status: "ACTIVE" },
        select: { canonicalUrl: true, sourceUrl: true, metadata: true },
      });
      for (const job of activeJobs) {
        uniqueCanonicalJobs.add(job.canonicalUrl ?? job.sourceUrl);
        const metadata = job.metadata as { jobType?: string } | null;
        if (metadata?.jobType === "government") officialGovernmentJobs++;
      }
      evidence.push({
        persona: persona.name,
        raw: result.total,
        relevant: result.relevant,
        new: result.new,
        saved,
        active,
        stageCounts: result.searchStageCounts,
        sources: result.sources.map((source) => ({
          source: source.source,
          success: source.success,
          fetched: source.fetched,
          relevant: source.relevant,
          durationMs: source.durationMs,
          error: source.error,
        })),
        durationMs: result.timings.totalSearchMs,
      });
      console.log(
        JSON.stringify({
          progress: `${index + 1}/${selectedPersonas.length}`,
          ...evidence.at(-1),
        })
      );
    }

    console.log(
      JSON.stringify(
        {
          runId,
          verifiedAt: new Date().toISOString(),
          personas: evidence.length,
          totalRaw: evidence.reduce(
            (sum, item) => sum + Number(item.raw ?? 0),
            0
          ),
          totalRelevant: evidence.reduce(
            (sum, item) => sum + Number(item.relevant ?? 0),
            0
          ),
          totalSaved: evidence.reduce(
            (sum, item) => sum + Number(item.saved ?? 0),
            0
          ),
          uniqueRealJobs: uniqueCanonicalJobs.size,
          officialGovernmentJobs,
          evidence,
        },
        null,
        2
      )
    );
  } finally {
    if (createdUserIds.length > 0) {
      const cleanup = await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
      console.log(
        JSON.stringify({
          cleanup: true,
          deletedTemporaryUsers: cleanup.count,
          expected: createdUserIds.length,
        })
      );
    }
    await prisma.$disconnect();
  }
}

void main();
