export function postAuthDestination(input: {
  next: string;
  onboardingComplete: boolean;
}) {
  if (input.next === "/reset-password") return "/reset-password";
  return input.onboardingComplete ? input.next : "/dashboard/onboarding";
}

export function shouldRedirectAuthenticatedAuthPage(pathname: string) {
  if (pathname.startsWith("/auth/")) return false;
  if (pathname.startsWith("/reset-password")) return false;
  return [
    "/login",
    "/signup",
    "/forgot-password",
    "/verify-email",
  ].some((path) => pathname.startsWith(path));
}
