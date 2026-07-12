"use client";

import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        theme="light"
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--surface)",
            border: "1px solid var(--line)",
            color: "var(--ink)",
            fontSize: "13px",
          },
        }}
        className="sm:!top-auto sm:!bottom-4 sm:!right-4"
      />
    </>
  );
}
