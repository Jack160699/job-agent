"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Toaster = dynamic(() => import("sonner").then((module) => module.Toaster), {
  ssr: false,
});

export function Providers() {
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    const activate = () => setHasInteracted(true);

    window.addEventListener("pointerdown", activate, { once: true, passive: true });
    window.addEventListener("keydown", activate, { once: true });

    return () => {
      window.removeEventListener("pointerdown", activate);
      window.removeEventListener("keydown", activate);
    };
  }, []);

  if (!hasInteracted) return null;

  return (
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
  );
}
