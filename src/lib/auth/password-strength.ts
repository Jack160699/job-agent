export type PasswordStrength = "weak" | "fair" | "good" | "strong";

export function evaluatePasswordStrength(password: string): {
  strength: PasswordStrength;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score += 1;
  else feedback.push("Use at least 8 characters");

  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  else feedback.push("Mix uppercase and lowercase letters");

  if (/\d/.test(password)) score += 1;
  else feedback.push("Add a number");

  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  else feedback.push("Add a symbol for stronger security");

  const strength: PasswordStrength =
    score <= 1 ? "weak" : score <= 2 ? "fair" : score <= 3 ? "good" : "strong";

  return { strength, score, feedback };
}

export function isPasswordAcceptable(password: string): boolean {
  const { strength } = evaluatePasswordStrength(password);
  return password.length >= 8 && strength !== "weak";
}
