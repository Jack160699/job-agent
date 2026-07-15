"use client";

import { useEffect } from "react";

export function RevealController() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const landingPage = document.querySelector<HTMLElement>(".landing-page");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let observer: IntersectionObserver | null = null;
    const initialize = () => {
      landingPage?.classList.add("landing-motion-ready");
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            observer?.unobserve(entry.target);
          });
        },
        { rootMargin: "0px 0px -10%", threshold: 0.12 }
      );

      elements.forEach((element) => observer?.observe(element));
    };

    window.addEventListener("scroll", initialize, { once: true, passive: true });
    return () => {
      window.removeEventListener("scroll", initialize);
      observer?.disconnect();
    };
  }, []);

  return null;
}
