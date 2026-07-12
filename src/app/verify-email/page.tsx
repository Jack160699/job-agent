import { Suspense } from "react";
import VerifyEmailPage from "./page.client";

export default function VerifyEmailWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-zinc-500">
          Loading…
        </div>
      }
    >
      <VerifyEmailPage />
    </Suspense>
  );
}
