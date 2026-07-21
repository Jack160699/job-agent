export type Seniority =
  | "INTERN"
  | "ENTRY"
  | "JUNIOR"
  | "MID"
  | "SENIOR"
  | "LEAD"
  | "MANAGER"
  | "UNKNOWN";

const TITLE_FAMILIES: Record<string, string[]> = {
  software_engineering: [
    "software engineer",
    "software developer",
    "software engineer i",
    "associate software engineer",
    "graduate engineer trainee",
    "junior software developer",
    "junior software engineer",
    "junior backend developer",
    "junior frontend developer",
    "junior full stack developer",
    "entry level developer",
    "trainee software engineer",
    "full stack developer",
    "web developer",
    "application developer",
    "qa engineer",
    "junior qa engineer",
    "technical support engineer",
    "implementation engineer",
    "programmer",
  ],
  frontend: [
    "frontend developer",
    "front end developer",
    "frontend engineer",
    "react developer",
    "react engineer",
    "ui developer",
    "junior frontend developer",
  ],
  backend: [
    "backend developer",
    "back end developer",
    "backend engineer",
    "server side engineer",
    "api developer",
    "node.js developer",
    "nodejs developer",
    "junior backend developer",
  ],
  operations_analysis: [
    "operations analyst",
    "business operations analyst",
    "business operations associate",
    "technical operations analyst",
    "product operations analyst",
    "product operations associate",
    "implementation analyst",
    "implementation associate",
    "process analyst",
    "process operations associate",
    "operations associate",
    "support operations analyst",
    "customer operations associate",
    "customer onboarding associate",
    "client onboarding specialist",
    "client success associate",
    "payment operations analyst",
    "payment operations associate",
    "logistics operations analyst",
    "logistics operations associate",
    "back office executive",
    "mis executive",
    "service delivery analyst",
    "service delivery associate",
    "business ops analyst",
    "operations specialist",
  ],
  ai_automation: [
    "ai automation engineer",
    "ai engineer",
    "applied ai engineer",
    "workflow automation engineer",
    "automation developer",
    "ai integration engineer",
    "solutions engineer",
    "python automation engineer",
    "machine learning engineer",
  ],
  banking: [
    "banking associate",
    "banking operations associate",
    "banking operations analyst",
    "banking officer",
    "probationary officer",
    "bank clerk",
    "relationship officer",
    "relationship manager",
    "credit analyst",
    "loan operations associate",
    "branch operations executive",
    "financial operations analyst",
    "risk analyst",
    "compliance analyst",
    "kyc analyst",
    "aml analyst",
    "fraud analyst",
    "collections executive",
    "customer service officer",
    "accounts assistant",
    "finance associate",
    "insurance operations associate",
    "fintech operations analyst",
    "payment operations analyst",
    "reconciliation analyst",
    "back office executive",
    "apprentice",
    "junior associate",
    "finance operations analyst",
  ],
  nursing_healthcare: [
    "healthcare specialist",
    "clinical specialist",
    "clinical research associate",
    "staff nurse",
    "ward nurse",
    "icu nurse",
    "nurse practitioner",
    "registered nurse",
    "nursing officer",
    "clinical nurse",
    "ot nurse",
    "community health officer",
    "clinical coordinator",
    "clinical associate",
    "healthcare associate",
    "healthcare coordinator",
    "healthcare support executive",
    "hospital operations executive",
    "medical officer",
    "medical representative",
    "patient care coordinator",
    "medical operations associate",
    "clinical data coordinator",
    "medical data associate",
    "medical support specialist",
    "healthcare customer support",
    "medical claims associate",
    "health insurance operations",
    "health insurance operations associate",
    "claims processor",
    "claims analyst",
    "medical billing associate",
    "clinical research coordinator",
    "pharmacovigilance associate",
    "pharmacy assistant",
    "lab coordinator",
  ],
  teaching_education: [
    "teacher",
    "assistant teacher",
    "primary teacher",
    "secondary teacher",
    "school teacher",
    "subject teacher",
    "faculty",
    "lecturer",
    "assistant professor",
    "education coordinator",
    "academic coordinator",
    "curriculum associate",
    "education counsellor",
    "academic operations associate",
    "teaching assistant",
    "trainer",
    "learning support specialist",
    "instructional designer",
    "academic counsellor",
  ],
  sales_marketing: [
    "sales executive",
    "business development executive",
    "business development representative",
    "account executive",
    "marketing executive",
    "digital marketing executive",
    "growth marketing associate",
    "customer success associate",
  ],
  technician_apprentice: [
    "technician",
    "junior engineer",
    "diploma engineer trainee",
    "engineering apprentice",
    "technician apprentice",
    "graduate apprentice",
    "maintenance technician",
    "electrical technician",
    "mechanical technician",
    "electronics technician",
    "field service technician",
    "service engineer",
    "plant operator",
    "machine operator",
    "technical assistant",
  ],
  technical_support: [
    "technical support",
    "application support",
    "product support",
    "support engineer",
  ],
  human_resources: [
    "hr executive",
    "human resources executive",
    "talent acquisition executive",
    "recruitment executive",
    "recruiter",
  ],
  finance_analysis: [
    "finance analyst",
    "financial analyst",
    "fp a analyst",
  ],
  mechanical_engineering: [
    "mechanical engineer",
    "manufacturing engineer",
    "production engineer",
    "design engineer",
  ],
};

const LOCATION_GROUPS: Record<string, string[]> = {
  pune: [
    "pune",
    "pimpri chinchwad",
    "pimpri-chinchwad",
    "pcmc",
    "chinchwad",
    "pimpri",
    "hinjewadi",
    "wakad",
    "chakan",
    "kharadi",
    "baner",
    "hadapsar",
    "viman nagar",
    "magarpatta",
  ],
  mumbai: ["mumbai", "bombay", "navi mumbai", "thane"],
  bengaluru: ["bengaluru", "bangalore"],
  hyderabad: ["hyderabad", "secunderabad"],
  chennai: ["chennai", "madras"],
  delhi_ncr: [
    "delhi",
    "new delhi",
    "delhi ncr",
    "ncr",
    "gurugram",
    "gurgaon",
    "noida",
    "greater noida",
    "faridabad",
    "ghaziabad",
  ],
  kolkata: ["kolkata", "calcutta"],
  ahmedabad: ["ahmedabad", "gandhinagar"],
  jaipur: ["jaipur"],
  indore: ["indore"],
  chandigarh: ["chandigarh", "mohali", "panchkula"],
  kochi: ["kochi", "cochin", "ernakulam"],
};

// Phase E: state-level markers. Lets a state-only job posting (e.g. "Maharashtra,
// India" with no city named) be recognized as a broader — not identical — match
// for a user whose preferred city sits in that state, without ever treating it
// as a confident exact-location match or silently swapping in a different city.
const STATE_GROUPS: Record<string, string[]> = {
  maharashtra: ["maharashtra"],
  karnataka: ["karnataka"],
  telangana: ["telangana"],
  tamil_nadu: ["tamil nadu", "tamilnadu"],
  delhi_state: ["delhi", "ncr"],
  west_bengal: ["west bengal"],
  gujarat: ["gujarat"],
  rajasthan: ["rajasthan"],
  punjab: ["punjab"],
  kerala: ["kerala"],
};

const CITY_STATE: Record<string, string> = {
  pune: "maharashtra",
  mumbai: "maharashtra",
  bengaluru: "karnataka",
  hyderabad: "telangana",
  chennai: "tamil_nadu",
  delhi_ncr: "delhi_state",
  kolkata: "west_bengal",
  ahmedabad: "gujarat",
  jaipur: "rajasthan",
  chandigarh: "punjab",
  kochi: "kerala",
};

const INDIA_MARKERS = [
  "india",
  "bharat",
  ...Object.values(LOCATION_GROUPS).flat(),
  "lucknow",
  "bhopal",
  "nagpur",
  "surat",
  "vadodara",
  "coimbatore",
  "mysuru",
  "mysore",
  "bhubaneswar",
  "visakhapatnam",
  "vizag",
  "patna",
  "ranchi",
  "dehradun",
  "guwahati",
];

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTitle(value: string): {
  normalized: string;
  family: string | null;
  seniority: Seniority;
} {
  const normalized = normalizeText(value)
    .replace(/\b(sr|senior)\b/g, " senior ")
    .replace(/\b(jr|junior)\b/g, " junior ")
    .replace(/\s+/g, " ")
    .trim();

  const family =
    Object.entries(TITLE_FAMILIES).find(([, aliases]) =>
      aliases.some((alias) => normalized.includes(alias))
    )?.[0] ?? null;

  return {
    normalized,
    family,
    seniority: detectSeniority(normalized),
  };
}

export function detectSeniority(value: string): Seniority {
  const text = normalizeText(value);
  if (/\b(intern|internship|trainee|apprentice)\b/.test(text)) return "INTERN";
  if (/\b(manager|head|director|vp|vice president)\b/.test(text)) return "MANAGER";
  // "Staff" is a professional nursing title, not an engineering seniority
  // marker. Treating Staff Nurse as a lead role excluded entry-level nurses.
  if (/\bstaff nurse\b/.test(text)) return "UNKNOWN";
  if (/\b(lead|principal|staff|architect)\b/.test(text)) return "LEAD";
  if (/\b(senior|sr)\b/.test(text)) return "SENIOR";
  if (/\b(junior|jr|associate)\b/.test(text)) return "JUNIOR";
  if (/\b(entry level|entry|fresher|graduate)\b/.test(text)) return "ENTRY";
  if (/\b(mid level|mid)\b/.test(text)) return "MID";
  return "UNKNOWN";
}

export function seniorityForExperience(years: number | null): Seniority {
  if (years == null) return "UNKNOWN";
  if (years <= 0) return "ENTRY";
  if (years <= 2) return "JUNIOR";
  if (years <= 5) return "MID";
  if (years <= 9) return "SENIOR";
  return "LEAD";
}

export function isSeniorityCompatible(
  user: Seniority,
  role: Seniority,
  selectedInternship: boolean
): { compatible: boolean; reason?: string } {
  if (role === "UNKNOWN" || user === "UNKNOWN") return { compatible: true };
  if (role === "INTERN") {
    return selectedInternship
      ? { compatible: true }
      : { compatible: false, reason: "Internship was not selected" };
  }
  const rank: Record<Seniority, number> = {
    INTERN: 0,
    ENTRY: 1,
    JUNIOR: 2,
    MID: 3,
    SENIOR: 4,
    LEAD: 5,
    MANAGER: 6,
    UNKNOWN: 2,
  };
  if (rank[role] > rank[user] + 1) {
    return {
      compatible: false,
      reason: `${role.toLowerCase()} role exceeds the user's supported seniority`,
    };
  }
  return { compatible: true };
}

export function titlesAreRelated(target: string, candidate: string): boolean {
  const left = normalizeTitle(target);
  const right = normalizeTitle(candidate);
  if (left.family && right.family) {
    if (left.family === right.family) return true;
    const softwareCluster = new Set([
      "software_engineering",
      "frontend",
      "backend",
      "technical_support",
    ]);
    if (softwareCluster.has(left.family) && softwareCluster.has(right.family)) {
      return true;
    }
  }
  return (
    left.normalized.includes(right.normalized) ||
    right.normalized.includes(left.normalized)
  );
}

export function expandRoleTitles(titles: string[]): string[] {
  const expanded = new Set<string>();
  for (const title of titles) {
    const normalized = normalizeTitle(title);
    expanded.add(title.trim());
    if (normalized.family) {
      for (const alias of TITLE_FAMILIES[normalized.family]) expanded.add(alias);
    }
  }
  return [...expanded].filter(Boolean);
}

/** Best-effort city/country hint from public index text; never fabricates a preference city. */
export function extractLocationHint(
  text: string,
  preferredLocations: string[] = []
): string | undefined {
  const normalized = normalizeText(text);
  if (!normalized) return undefined;
  for (const preferred of preferredLocations) {
    const marker = normalizeText(preferred);
    if (
      marker &&
      marker !== "remote" &&
      marker !== "india" &&
      normalized.includes(marker)
    ) {
      return preferred;
    }
  }
  for (const [, aliases] of Object.entries(LOCATION_GROUPS)) {
    const hit = aliases.find((alias) => normalized.includes(alias));
    if (hit) return hit;
  }
  if (normalized.includes("india") || normalized.includes("bharat")) {
    return "India";
  }
  return undefined;
}

export function inferTitleFamily(titles: string[]): string | null {
  for (const title of titles) {
    const family = normalizeTitle(title).family;
    if (family) return family;
  }
  return null;
}

export function normalizeLocation(value: string): {
  normalized: string;
  group: string | null;
  state: string | null;
  country: "IN" | "OTHER" | "UNKNOWN";
  remote: boolean;
  remoteScope: "INDIA" | "WORLDWIDE" | "UNKNOWN";
  remoteRestricted: boolean;
} {
  const normalized = normalizeText(value);
  const group =
    Object.entries(LOCATION_GROUPS).find(([, aliases]) =>
      aliases.some(
        (alias) => normalized.includes(alias) || alias.includes(normalized)
      )
    )?.[0] ?? null;
  const state =
    (group ? CITY_STATE[group] : null) ??
    Object.entries(STATE_GROUPS).find(([, aliases]) =>
      aliases.some((alias) => normalized.includes(alias))
    )?.[0] ??
    null;
  const remote = /\b(remote|work from home|wfh)\b/.test(normalized);
  const india = INDIA_MARKERS.some((marker) => normalized.includes(marker));
  const worldwide = /\b(worldwide|global|anywhere)\b/.test(normalized);
  // Explicit non-India restriction stated on the posting itself — this is the
  // only case that should ever hard-exclude a remote role for an India-based
  // candidate. Anything else (unstated, worldwide) stays eligible-but-uncertain
  // rather than being silently dropped.
  const remoteRestricted =
    /\b(us only|u s only|usa only|united states only|eu only|europe only|uk only|europe residents only|based in the us|must reside in the us|us residents only|us citizens only)\b/.test(
      normalized
    );

  return {
    normalized,
    group,
    state,
    country: india ? "IN" : normalized ? "OTHER" : "UNKNOWN",
    remote,
    remoteScope: india ? "INDIA" : worldwide ? "WORLDWIDE" : "UNKNOWN",
    remoteRestricted,
  };
}

export function locationsAreCompatible(
  preferredLocations: string[],
  jobLocation: string | undefined,
  options: {
    remotePreferred: boolean;
    willingToRelocate: boolean;
  }
): { matched: boolean; reason: string; uncertain?: boolean } {
  const preferences = preferredLocations.map(normalizeLocation);
  const job = normalizeLocation(jobLocation ?? "");
  const indiaFirst = preferences.some((location) => location.country === "IN");

  if (job.remote && options.remotePreferred) {
    if (indiaFirst && job.remoteRestricted) {
      return {
        matched: false,
        reason: "Remote role is explicitly restricted to a non-India location",
      };
    }
    if (indiaFirst && job.remoteScope === "WORLDWIDE") {
      return {
        matched: false,
        reason: "Worldwide remote role is not confirmed as India-eligible",
        uncertain: true,
      };
    }
    if (indiaFirst && job.country !== "IN" && job.remoteScope === "UNKNOWN") {
      return {
        matched: false,
        reason: "Remote role does not confirm India eligibility",
        uncertain: true,
      };
    }
    return {
      matched: true,
      reason: indiaFirst
        ? "India-remote role matches remote preference"
        : "Remote role matches remote preference",
    };
  }

  if (!job.normalized) {
    return options.willingToRelocate
      ? { matched: true, reason: "Location missing; relocation is enabled", uncertain: true }
      : { matched: false, reason: "Location is missing and relocation is disabled" };
  }

  const aliasMatch = preferences.some(
    (preferred) =>
      (preferred.group && preferred.group === job.group) ||
      preferred.normalized === job.normalized ||
      job.normalized.includes(preferred.normalized) ||
      preferred.normalized.includes(job.normalized)
  );
  if (aliasMatch) {
    return {
      matched: true,
      reason: `Location ${jobLocation} matches a preferred area`,
    };
  }

  // Phase E: state-level broadening. A posting naming only a state (e.g.
  // "Maharashtra, India") that contains a preferred city is a plausible but
  // unconfirmed match — surfaced as uncertain rather than silently dropped
  // or silently treated as an exact-city match.
  const stateMatch = preferences.some(
    (preferred) => preferred.group && job.state && CITY_STATE[preferred.group] === job.state
  );
  if (stateMatch) {
    return {
      matched: true,
      reason: `Location ${jobLocation} is in the same state as a preferred city; exact city is unconfirmed`,
      uncertain: true,
    };
  }

  if (options.willingToRelocate) {
    return {
      matched: true,
      reason: `Location ${jobLocation} is outside preferences; relocation is enabled`,
    };
  }

  return {
    matched: false,
    reason: `Location ${jobLocation} is outside preferred locations`,
  };
}
