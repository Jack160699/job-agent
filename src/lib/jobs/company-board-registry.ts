import type { UserSettings } from "@prisma/client";
import { normalizeText } from "./normalization";

export type BoardPlatform = "greenhouse" | "lever" | "ashby" | "workday";

export interface CompanyBoardDefinition {
  company: string;
  platform: BoardPlatform;
  board: string;
  sectors: string[];
  roleFamilies: string[];
  indiaHiring: true;
  verificationMethod: "public_api";
}

/**
 * Public, server-readable employer boards verified against their official ATS
 * endpoints. A registry entry does not claim that the board always has a
 * suitable opening for every candidate.
 */
export const INDIA_COMPANY_BOARD_REGISTRY: CompanyBoardDefinition[] = [
  {
    company: "Postman",
    platform: "greenhouse",
    board: "postman",
    sectors: ["software", "sales", "marketing", "operations"],
    roleFamilies: ["software", "ai", "operations", "sales", "marketing"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "PhonePe",
    platform: "greenhouse",
    board: "phonepe",
    sectors: ["banking", "fintech", "software", "operations", "sales"],
    roleFamilies: ["software", "banking", "operations", "sales", "marketing"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "Groww",
    platform: "greenhouse",
    board: "groww",
    sectors: ["banking", "fintech", "software", "operations"],
    roleFamilies: ["software", "banking", "operations"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "Razorpay",
    platform: "greenhouse",
    board: "razorpaysoftwareprivatelimited",
    sectors: ["banking", "fintech", "payments", "software", "operations"],
    roleFamilies: ["banking", "finance", "operations", "sales", "software"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "Tide",
    platform: "greenhouse",
    board: "tide",
    sectors: ["banking", "fintech", "finance", "operations", "software"],
    roleFamilies: ["banking", "finance", "operations", "compliance", "software"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "LivePerson",
    platform: "greenhouse",
    board: "liveperson",
    sectors: ["finance", "operations", "software", "customer support"],
    roleFamilies: ["finance", "accounts", "operations", "support", "software"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "Coursera",
    platform: "greenhouse",
    board: "coursera",
    sectors: ["education", "software", "sales", "marketing"],
    roleFamilies: ["education", "software", "sales", "marketing"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "Khan Academy",
    platform: "greenhouse",
    board: "khanacademy",
    sectors: ["education", "software"],
    roleFamilies: ["education", "software"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "Rubrik",
    platform: "greenhouse",
    board: "rubrik",
    sectors: ["software", "ai", "sales"],
    roleFamilies: ["software", "ai", "sales"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "Apollo.io",
    platform: "greenhouse",
    board: "apolloio",
    sectors: ["software", "sales", "marketing", "operations"],
    roleFamilies: ["software", "sales", "marketing", "operations"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "Slice",
    platform: "greenhouse",
    board: "slice",
    sectors: ["banking", "fintech", "software", "operations"],
    roleFamilies: ["software", "banking", "operations"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "Coupa",
    platform: "lever",
    board: "coupa",
    sectors: ["software", "operations", "sales"],
    roleFamilies: ["software", "operations", "implementation", "sales"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "Resilinc",
    platform: "lever",
    board: "resilinc",
    sectors: ["software", "ai", "operations", "healthcare"],
    roleFamilies: ["software", "ai", "operations"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "Kobie",
    platform: "lever",
    board: "kobie",
    sectors: ["software", "marketing", "sales"],
    roleFamilies: ["software", "marketing", "sales"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "RapidAI",
    platform: "lever",
    board: "rapidai",
    sectors: ["healthcare", "ai", "software"],
    roleFamilies: ["healthcare", "ai", "software"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "Bazaarvoice",
    platform: "lever",
    board: "bazaarvoice",
    sectors: ["software", "marketing", "sales"],
    roleFamilies: ["software", "marketing", "sales"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "Sonatype",
    platform: "lever",
    board: "sonatype",
    sectors: ["software", "ai"],
    roleFamilies: ["software", "ai"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "Zapier",
    platform: "ashby",
    board: "zapier",
    sectors: ["software", "ai", "automation", "operations"],
    roleFamilies: ["software", "ai", "automation", "operations"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "Sarvam AI",
    platform: "ashby",
    board: "sarvam",
    sectors: ["ai", "software", "sales", "operations"],
    roleFamilies: ["ai", "software", "solutions", "sales", "operations"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "PlayPower Labs",
    platform: "ashby",
    board: "playpowerlabs",
    sectors: ["education", "software", "ai"],
    roleFamilies: ["education", "software", "ai"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "Demandbase",
    platform: "ashby",
    board: "demandbase",
    sectors: ["software", "sales", "marketing", "ai"],
    roleFamilies: ["software", "sales", "marketing", "ai"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "CertifyOS",
    platform: "ashby",
    board: "certifyos",
    sectors: ["healthcare", "software", "operations"],
    roleFamilies: ["healthcare", "software", "operations"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "Ema",
    platform: "ashby",
    board: "ema",
    sectors: ["ai", "software", "automation"],
    roleFamilies: ["ai", "software", "automation"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "Commure",
    platform: "ashby",
    board: "Commure",
    sectors: ["healthcare", "medical claims", "finance", "operations", "software"],
    roleFamilies: [
      "healthcare",
      "medical claims",
      "finance",
      "operations",
      "support",
      "software",
    ],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "Medtronic",
    platform: "workday",
    board: "https://medtronic.wd1.myworkdayjobs.com/en-US/MedtronicCareers",
    sectors: ["healthcare", "engineering", "sales", "operations"],
    roleFamilies: ["healthcare", "engineering", "technician", "sales", "operations"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "Amgen",
    platform: "workday",
    board: "https://amgen.wd1.myworkdayjobs.com/en-US/Careers",
    sectors: ["healthcare", "software", "operations"],
    roleFamilies: ["healthcare", "software", "operations"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "DXC Technology",
    platform: "workday",
    board: "https://dxctechnology.wd1.myworkdayjobs.com/en-US/DXCJobs",
    sectors: ["software", "implementation", "operations", "sales"],
    roleFamilies: ["software", "implementation", "operations", "sales"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
  {
    company: "Astreya",
    platform: "workday",
    board:
      "https://astreya.wd5.myworkdayjobs.com/en-US/life-at-astreya-opportunities",
    sectors: ["software", "operations", "engineering"],
    roleFamilies: ["software", "operations", "technician", "engineering"],
    indiaHiring: true,
    verificationMethod: "public_api",
  },
];

function searchTerms(settings: UserSettings): string[] {
  return [
    ...settings.jobTitles,
    ...settings.industries,
    ...settings.requiredSkills,
  ]
    .flatMap((value) => normalizeText(value).split(" "))
    .filter((value) => value.length > 2);
}

function scoreBoard(
  board: CompanyBoardDefinition,
  terms: string[],
  requestedCompanies: string[]
): number {
  const company = normalizeText(board.company);
  const requested = requestedCompanies.some((value) => {
    const normalized = normalizeText(value);
    return normalized === company || company.includes(normalized);
  });
  const haystack = normalizeText(
    [board.company, ...board.sectors, ...board.roleFamilies].join(" ")
  );
  return (requested ? 100 : 0) + terms.filter((term) => haystack.includes(term)).length;
}

export function selectCompanyBoards(
  settings: UserSettings
): Record<BoardPlatform, string[]> {
  const terms = searchTerms(settings);
  const requestedCompanies = settings.targetCompanies
    .map((value) => value.trim())
    .filter(Boolean);
  const result: Record<BoardPlatform, string[]> = {
    greenhouse: [],
    lever: [],
    ashby: [],
    workday: [],
  };

  for (const platform of Object.keys(result) as BoardPlatform[]) {
    result[platform] = INDIA_COMPANY_BOARD_REGISTRY
      .filter((item) => item.platform === platform)
      .map((item) => ({
        item,
        score: scoreBoard(item, terms, requestedCompanies),
      }))
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.item.company.localeCompare(right.item.company)
      )
      .slice(0, 4)
      .map(({ item }) => item.board);
  }

  return result;
}
