"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { createPortal } from "react-dom";

const links = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#job-seekers", label: "For job seekers" },
  { href: "#employers", label: "For employers" },
  { href: "#career-partner", label: "AI career partner" },
  { href: "#pricing", label: "Pricing" },
] as const;

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    firstLinkRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className={`landing-mobile-navigation${open ? " is-open" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className="landing-icon-button"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="mobile-navigation-sheet"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X aria-hidden /> : <Menu aria-hidden />}
      </button>

      {open &&
        createPortal(
          <div className="landing-page landing-mobile-sheet-backdrop" onMouseDown={close}>
            <nav
              id="mobile-navigation-sheet"
              className="landing-mobile-sheet"
              aria-label="Mobile navigation"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="landing-mobile-sheet-header">
                <p className="landing-mobile-sheet-label">Explore Kairela</p>
                <button type="button" className="landing-mobile-sheet-close" onClick={close} aria-label="Close navigation">
                  <X aria-hidden />
                </button>
              </div>
              <div className="landing-mobile-sheet-links">
                {links.map((link, index) => (
                  <a
                    ref={index === 0 ? firstLinkRef : undefined}
                    key={link.href}
                    href={link.href}
                    onClick={close}
                  >
                    <span>{link.label}</span>
                    <ArrowUpRight aria-hidden />
                  </a>
                ))}
              </div>
              <div className="landing-mobile-sheet-actions">
                <Link href="/login" className="landing-button landing-button-secondary" onClick={close}>
                  Log in
                </Link>
                <Link href="/signup" className="landing-button landing-button-primary" onClick={close}>
                  Start free
                </Link>
              </div>
            </nav>
          </div>,
          document.body
        )}
    </div>
  );
}
