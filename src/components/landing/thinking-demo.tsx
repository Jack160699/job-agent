"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  FileCheck2,
  Link2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { thinkingSteps } from "@/lib/data/landing-demo";

const AUTO_STEP_MS = 1050;

export function ThinkingDemo() {
  const [activeStep, setActiveStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const demoRef = useRef<HTMLDivElement>(null);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotionRef.current || !demoRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPlaying(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(demoRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || activeStep >= thinkingSteps.length - 1) return;

    const timer = window.setTimeout(() => {
      const nextStep = Math.min(activeStep + 1, thinkingSteps.length - 1);
      setActiveStep(nextStep);
      if (nextStep === thinkingSteps.length - 1) setPlaying(false);
    }, AUTO_STEP_MS);

    return () => window.clearTimeout(timer);
  }, [activeStep, playing]);

  const replay = () => {
    setActiveStep(0);
    if (!reduceMotionRef.current) setPlaying(true);
  };

  const current = thinkingSteps[activeStep];
  const progress = ((activeStep + 1) / thinkingSteps.length) * 100;

  return (
    <div ref={demoRef} className="thinking-demo">
      <div className="thinking-demo-toolbar">
        <div>
          <span className="thinking-demo-kicker">Illustrative product demonstration</span>
          <p>No real application is being processed or submitted.</p>
        </div>
        <button type="button" className="landing-replay-button" onClick={replay}>
          <RefreshCw aria-hidden />
          Replay
        </button>
      </div>

      <div className="thinking-demo-progress-row">
        <span>Step {activeStep + 1} of {thinkingSteps.length}</span>
        <div
          className="thinking-demo-progress"
          role="progressbar"
          aria-label="Kairela demonstration progress"
          aria-valuemin={1}
          aria-valuemax={thinkingSteps.length}
          aria-valuenow={activeStep + 1}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="thinking-demo-grid">
        <ol className="thinking-demo-steps" aria-label="Kairela analysis steps">
          {thinkingSteps.map((step, index) => (
            <li
              key={step.title}
              className={index < activeStep ? "is-complete" : index === activeStep ? "is-active" : ""}
            >
              <span className="thinking-demo-step-index">
                {index < activeStep ? <Check aria-hidden /> : index + 1}
              </span>
              <span>
                <strong>{step.title}</strong>
                <small>{step.badge}</small>
              </span>
            </li>
          ))}
        </ol>

        <div className="thinking-demo-stage" aria-atomic="true">
          <div className="thinking-demo-url">
            <Link2 aria-hidden />
            <span>jobs.example.in/business-analyst-pune</span>
            <b>Public link</b>
          </div>

          <div className="thinking-demo-state" key={current.title}>
            <div className="thinking-demo-orbit" aria-hidden>
              <span><Sparkles /></span>
              <span><FileCheck2 /></span>
              <span><CalendarClock /></span>
            </div>
            <span className="thinking-demo-badge">{current.badge}</span>
            <h3>{current.title}</h3>
            <p>{current.detail}</p>
          </div>

          <div className="thinking-demo-summary">
            <div>
              <span>Match</span>
              <strong>{activeStep >= 3 ? "89%" : "—"}</strong>
            </div>
            <div>
              <span>Truth check</span>
              <strong>{activeStep >= 5 ? "Passed" : "Pending"}</strong>
            </div>
            <div>
              <span>Submission</span>
              <strong>{activeStep >= 7 ? "Review first" : "Not started"}</strong>
            </div>
          </div>

          <div className="thinking-demo-policy">
            <ShieldCheck aria-hidden />
            <span>Kairela can suggest and prepare. Aditi keeps control of submission.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
