export type FieldValue = string | number | boolean | string[] | null | undefined;

export interface FieldMergeInput {
  key: string;
  label: string;
  existingValue: FieldValue;
  incomingValue: FieldValue;
  /** True if the user has previously confirmed or manually edited this field. */
  existingConfirmed: boolean;
}

export type FieldMergeStatus = "filled" | "kept" | "conflict" | "unchanged";

export interface FieldMergeOutcome {
  key: string;
  label: string;
  value: FieldValue;
  existingValue: FieldValue;
  incomingValue: FieldValue;
  status: FieldMergeStatus;
}

function isEmptyValue(value: FieldValue): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}

function valuesEqual(a: FieldValue, b: FieldValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((v, i) => v === sortedB[i]);
  }
  return a === b;
}

/**
 * Safe merge policy for resume-derived data against an existing profile:
 * - Empty existing values are filled automatically from the resume.
 * - Existing user-confirmed values are preserved, never silently overwritten.
 * - A confirmed value that disagrees with the resume becomes a conflict for
 *   the user to resolve explicitly in the review screen.
 */
export function mergeField(input: FieldMergeInput): FieldMergeOutcome {
  const { key, label, existingValue, incomingValue, existingConfirmed } = input;

  if (isEmptyValue(incomingValue)) {
    return { key, label, value: existingValue, existingValue, incomingValue, status: "unchanged" };
  }

  if (isEmptyValue(existingValue)) {
    return { key, label, value: incomingValue, existingValue, incomingValue, status: "filled" };
  }

  if (valuesEqual(existingValue, incomingValue)) {
    return { key, label, value: existingValue, existingValue, incomingValue, status: "unchanged" };
  }

  if (!existingConfirmed) {
    return { key, label, value: incomingValue, existingValue, incomingValue, status: "filled" };
  }

  return { key, label, value: existingValue, existingValue, incomingValue, status: "conflict" };
}

export function mergeProfileFields(inputs: FieldMergeInput[]): {
  outcomes: FieldMergeOutcome[];
  conflicts: FieldMergeOutcome[];
} {
  const outcomes = inputs.map(mergeField);
  return { outcomes, conflicts: outcomes.filter((o) => o.status === "conflict") };
}

/** Applies user-chosen resolutions ("existing" | "incoming") for each conflicting field. */
export function applyConflictResolutions(
  outcomes: FieldMergeOutcome[],
  resolutions: Record<string, "existing" | "incoming">
): Record<string, FieldValue> {
  const result: Record<string, FieldValue> = {};
  for (const outcome of outcomes) {
    if (outcome.status !== "conflict") {
      result[outcome.key] = outcome.value;
      continue;
    }
    const choice = resolutions[outcome.key] ?? "existing";
    result[outcome.key] = choice === "incoming" ? outcome.incomingValue : outcome.existingValue;
  }
  return result;
}
