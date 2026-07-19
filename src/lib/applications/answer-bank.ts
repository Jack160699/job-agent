export type AnswerInputType =
  | "text"
  | "number"
  | "date"
  | "url"
  | "multiline"
  | "yes_no";

export interface AnswerDefinition {
  key: string;
  label: string;
  description: string;
  inputType: AnswerInputType;
  sensitive: boolean;
  legalOrEligibility: boolean;
}

export const APPLICATION_ANSWER_DEFINITIONS: AnswerDefinition[] = [
  {
    key: "work_authorization",
    label: "Work authorization",
    description: "Your confirmed legal authorization for the target country.",
    inputType: "text",
    sensitive: true,
    legalOrEligibility: true,
  },
  {
    key: "sponsorship",
    label: "Sponsorship required",
    description: "Whether you require employer visa sponsorship.",
    inputType: "yes_no",
    sensitive: true,
    legalOrEligibility: true,
  },
  {
    key: "notice_period",
    label: "Notice period",
    description: "Your confirmed notice period, for example 30 days.",
    inputType: "text",
    sensitive: false,
    legalOrEligibility: false,
  },
  {
    key: "salary_expectation",
    label: "Expected salary",
    description: "Your expected compensation including currency and period.",
    inputType: "text",
    sensitive: true,
    legalOrEligibility: false,
  },
  {
    key: "current_salary",
    label: "Current salary",
    description: "Your current compensation, only when you choose to store it.",
    inputType: "text",
    sensitive: true,
    legalOrEligibility: false,
  },
  {
    key: "start_date",
    label: "Available start date",
    description: "The earliest date you can start.",
    inputType: "date",
    sensitive: false,
    legalOrEligibility: false,
  },
  {
    key: "relocation",
    label: "Willing to relocate",
    description: "Whether you are willing to relocate for a role.",
    inputType: "yes_no",
    sensitive: false,
    legalOrEligibility: false,
  },
  {
    key: "remote",
    label: "Remote preference",
    description: "Whether you are open to remote work.",
    inputType: "yes_no",
    sensitive: false,
    legalOrEligibility: false,
  },
  {
    key: "travel_willingness",
    label: "Travel willingness",
    description: "How much work travel you have explicitly accepted.",
    inputType: "text",
    sensitive: false,
    legalOrEligibility: false,
  },
  {
    key: "years_experience",
    label: "Years of experience",
    description: "Your confirmed total relevant experience.",
    inputType: "number",
    sensitive: false,
    legalOrEligibility: false,
  },
  {
    key: "portfolio",
    label: "Portfolio links",
    description: "Portfolio, GitHub, or other work-sample links.",
    inputType: "multiline",
    sensitive: false,
    legalOrEligibility: false,
  },
  {
    key: "government_category",
    label: "Government category",
    description: "Reservation/category information only when explicitly provided.",
    inputType: "text",
    sensitive: true,
    legalOrEligibility: true,
  },
  {
    key: "government_eligibility",
    label: "Government eligibility",
    description: "A confirmed eligibility answer for public-sector applications.",
    inputType: "multiline",
    sensitive: true,
    legalOrEligibility: true,
  },
];

export const APPLICATION_ANSWER_DEFINITION_MAP = new Map(
  APPLICATION_ANSWER_DEFINITIONS.map((definition) => [
    definition.key,
    definition,
  ])
);

export function normalizeAnswerValue(
  definition: AnswerDefinition,
  value: unknown
): string | number {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error("Answer must be text or a number");
  }
  const normalized = typeof value === "string" ? value.trim() : value;
  if (normalized === "") throw new Error("Answer is required");
  if (definition.inputType === "number") {
    const numeric = Number(normalized);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 80) {
      throw new Error("Enter a valid number");
    }
    return numeric;
  }
  if (
    definition.inputType === "yes_no" &&
    !["Yes", "No"].includes(String(normalized))
  ) {
    throw new Error("Choose Yes or No");
  }
  return String(normalized).slice(0, 4_000);
}
