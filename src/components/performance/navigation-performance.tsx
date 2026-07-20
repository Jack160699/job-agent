"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

interface NavigationTimingSample {
  from: string;
  to: string;
  clickFeedbackMs: number | null;
  routeCommitMs: number;
  firstUsefulContentMs: number;
  loadingBoundaryMs: number | null;
  capturedAt: string;
}

declare global {
  interface Window {
    __KAIRELA_PERFORMANCE__?: {
      samples: NavigationTimingSample[];
      hydrationCompleteMs: number;
    };
  }
}

const STORAGE_KEY = "kairela:performance:v1";

function safeRoute(pathname: string): string {
  const known = [
    "/dashboard/applications",
    "/dashboard/cover-letters",
    "/dashboard/resumes",
    "/dashboard/settings",
    "/dashboard/sources",
    "/dashboard/answers",
    "/dashboard/matches",
    "/dashboard/jobs",
    "/dashboard",
  ];
  return known.find((route) =>
    route === "/dashboard"
      ? pathname === route
      : pathname === route || pathname.startsWith(`${route}/`)
  ) ?? "other";
}

function storedSamples(): NavigationTimingSample[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.slice(-99) : [];
  } catch {
    return [];
  }
}

export function NavigationPerformance() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const navigation = useRef<{
    startedAt: number;
    from: string;
    to: string;
    feedbackAt: number | null;
    loadingAt: number | null;
  } | null>(null);

  useEffect(() => {
    const hydrationCompleteMs = Math.max(0, performance.now());
    const samples = storedSamples();
    window.__KAIRELA_PERFORMANCE__ = { samples, hydrationCompleteMs };
    performance.mark("kairela:hydration-complete");

    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        destination.pathname === window.location.pathname
      ) {
        return;
      }

      performance.clearMarks("kairela:navigation-click");
      performance.mark("kairela:navigation-click");
      navigation.current = {
        startedAt: performance.now(),
        from: safeRoute(window.location.pathname),
        to: safeRoute(destination.pathname),
        feedbackAt: null,
        loadingAt: null,
      };
      setPending(true);
      requestAnimationFrame(() => {
        if (!navigation.current) return;
        navigation.current.feedbackAt = performance.now();
        performance.mark("kairela:pressed-state-painted");
      });
    };

    const loadingObserver = new MutationObserver(() => {
      if (
        navigation.current &&
        navigation.current.loadingAt == null &&
        document.querySelector("[data-navigation-loading]")
      ) {
        navigation.current.loadingAt = performance.now();
        performance.mark("kairela:loading-boundary-shown");
      }
    });
    loadingObserver.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick, true);
    return () => {
      loadingObserver.disconnect();
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  useEffect(() => {
    const current = navigation.current;
    if (!current || current.to !== safeRoute(pathname)) return;
    const committedAt = performance.now();
    performance.mark("kairela:route-committed");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const usefulAt = performance.now();
        performance.mark("kairela:first-useful-content");
        const sample: NavigationTimingSample = {
          from: current.from,
          to: current.to,
          clickFeedbackMs:
            current.feedbackAt == null
              ? null
              : Math.round((current.feedbackAt - current.startedAt) * 10) / 10,
          routeCommitMs:
            Math.round((committedAt - current.startedAt) * 10) / 10,
          firstUsefulContentMs:
            Math.round((usefulAt - current.startedAt) * 10) / 10,
          loadingBoundaryMs:
            current.loadingAt == null
              ? null
              : Math.round((current.loadingAt - current.startedAt) * 10) / 10,
          capturedAt: new Date().toISOString(),
        };
        const samples = [...storedSamples(), sample].slice(-100);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
        if (window.__KAIRELA_PERFORMANCE__) {
          window.__KAIRELA_PERFORMANCE__.samples = samples;
        }
        navigation.current = null;
        setPending(false);
      });
    });
  }, [pathname]);

  return (
    <div
      aria-hidden="true"
      data-navigation-feedback={pending ? "pending" : "idle"}
      className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden transition-opacity ${
        pending ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="h-full w-2/3 animate-pulse bg-[var(--accent)]" />
    </div>
  );
}
