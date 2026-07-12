import { describe, expect, it } from "vitest";
import {
  computeCompletionPct,
  nextStep,
  stepsForPersona,
} from "@/lib/onboarding/steps";

describe("onboarding steps", () => {
  it("job seeker flow includes resume step", () => {
    const steps = stepsForPersona("JOB_SEEKER");
    expect(steps).toContain("resume");
    expect(steps[0]).toBe("welcome");
    expect(steps.at(-1)).toBe("complete");
  });

  it("advances to next step", () => {
    expect(nextStep("JOB_SEEKER", "welcome")).toBe("basics");
    expect(nextStep("JOB_SEEKER", "basics")).toBe("goals");
  });

  it("computes completion percentage for partial profile", () => {
    const pct = computeCompletionPct(
      "JOB_SEEKER",
      {
        persona: "JOB_SEEKER",
        fullName: "Ada",
        currentLocation: "Pune",
        jobTitles: ["Frontend Developer"],
        experienceYears: 3,
        requiredSkills: ["React"],
        locations: ["Pune"],
        workModes: ["REMOTE"],
      },
      false
    );
    expect(pct).toBeGreaterThan(40);
    expect(pct).toBeLessThan(100);
  });

  it("explorer with persona selected reaches high completion", () => {
    const pct = computeCompletionPct("EXPLORER", { persona: "EXPLORER" }, false);
    expect(pct).toBe(100);
  });
});
