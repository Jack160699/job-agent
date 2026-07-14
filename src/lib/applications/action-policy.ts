export interface SubmissionAuthorization {
  autoSubmit: boolean;
  confirmed: boolean;
}

export type SubmissionAuthorizationResult =
  | { allowed: true }
  | {
      allowed: false;
      code: "SUBMISSION_CONFIRMATION_REQUIRED";
      message: string;
    };

export function validateSubmissionAuthorization(
  authorization: SubmissionAuthorization
): SubmissionAuthorizationResult {
  if (!authorization.autoSubmit) return { allowed: true };
  if (authorization.confirmed) return { allowed: true };

  return {
    allowed: false,
    code: "SUBMISSION_CONFIRMATION_REQUIRED",
    message:
      "Confirm that you reviewed the application and authorize submission.",
  };
}
