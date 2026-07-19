import {
  AshbyAdapter,
  GreenhouseAdapter,
  LeverAdapter,
  WorkdayAdapter,
} from "../src/lib/jobs/adapters";
import type { JobSearchFilters } from "../src/lib/jobs/types";

const filters: JobSearchFilters = {
  titles: ["Software Engineer"],
  queries: [
    {
      title: "Software Engineer",
      location: "India",
      remoteScope: "INDIA",
      stage: "strict",
      reasons: ["Live source verification"],
    },
    {
      title: "Backend Engineer",
      location: "India",
      remoteScope: "INDIA",
      stage: "balanced",
      reasons: ["Live source verification"],
    },
    {
      title: "Developer",
      location: "India",
      remoteScope: "INDIA",
      stage: "recovery",
      reasons: ["Live source verification"],
    },
  ],
  locations: ["India"],
  remote: true,
  discoveryBoards: {
    greenhouse: ["postman", "phonepe", "groww", "rubrik"],
    lever: ["coupa", "resilinc", "sonatype", "bazaarvoice"],
    ashby: ["sarvam", "playpowerlabs", "demandbase", "certifyos"],
    workday: [
      "https://medtronic.wd1.myworkdayjobs.com/en-US/MedtronicCareers",
    ],
  },
};

const indiaPattern =
  /india|bengaluru|bangalore|pune|hyderabad|chennai|gurugram|noida|remote/i;
const adapters = [
  new GreenhouseAdapter(),
  new LeverAdapter(),
  new AshbyAdapter(),
  new WorkdayAdapter(),
];

async function main() {
  const results = await Promise.all(
    adapters.map(async (adapter) => {
      const startedAt = Date.now();
      const jobs = await adapter.search(filters);
      return {
        source: adapter.source,
        count: jobs.length,
        indiaOrRemote: jobs.filter((job) =>
          indiaPattern.test(job.location ?? "")
        ).length,
        durationMs: Date.now() - startedAt,
        sample: jobs.slice(0, 3).map((job) => ({
          title: job.title,
          location: job.location,
          url: job.sourceUrl,
          stage: job.metadata?.searchStage,
        })),
      };
    })
  );

  console.log(
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        total: results.reduce((sum, result) => sum + result.count, 0),
        indiaOrRemote: results.reduce(
          (sum, result) => sum + result.indiaOrRemote,
          0
        ),
        results,
      },
      null,
      2
    )
  );
}

void main();
