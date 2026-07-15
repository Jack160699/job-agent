"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";

function ThinkingDemoPoster() {
  return (
    <div className="thinking-demo thinking-demo-poster" role="status" aria-label="Loading Kairela product demonstration">
      <div className="thinking-demo-toolbar">
        <div>
          <span className="thinking-demo-kicker">Illustrative product demonstration</span>
          <p>Preparing the nine-step walkthrough…</p>
        </div>
      </div>
      <div className="thinking-demo-poster-stage">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export function ThinkingDemoLoader() {
  const loaderRef = useRef<HTMLDivElement>(null);
  const [Demo, setDemo] = useState<ComponentType | null>(null);

  useEffect(() => {
    const target = loaderRef.current;
    if (!target) return;

    let active = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;

        observer.disconnect();
        void import("@/components/landing/thinking-demo").then((module) => {
          if (active) setDemo(() => module.ThinkingDemo);
        });
      },
      { rootMargin: "500px 0px", threshold: 0.01 }
    );

    observer.observe(target);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={loaderRef} className="thinking-demo-loader" data-testid="thinking-demo">
      {Demo ? <Demo /> : <ThinkingDemoPoster />}
    </div>
  );
}
