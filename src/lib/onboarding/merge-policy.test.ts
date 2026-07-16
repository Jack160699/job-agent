import { describe, expect, it } from "vitest";
import { applyConflictResolutions, mergeField, mergeProfileFields } from "./merge-policy";

describe("mergeField", () => {
  it("fills an empty existing value from the resume", () => {
    const outcome = mergeField({
      key: "currentLocation",
      label: "Current location",
      existingValue: null,
      incomingValue: "Pune, India",
      existingConfirmed: false,
    });
    expect(outcome.status).toBe("filled");
    expect(outcome.value).toBe("Pune, India");
  });

  it("preserves a user-confirmed value when the resume disagrees", () => {
    const outcome = mergeField({
      key: "currentLocation",
      label: "Current location",
      existingValue: "Bangalore, India",
      incomingValue: "Pune, India",
      existingConfirmed: true,
    });
    expect(outcome.status).toBe("conflict");
    expect(outcome.value).toBe("Bangalore, India");
  });

  it("fills an unconfirmed value even if one already exists (e.g. an old default)", () => {
    const outcome = mergeField({
      key: "currentLocation",
      label: "Current location",
      existingValue: "Bangalore, India",
      incomingValue: "Pune, India",
      existingConfirmed: false,
    });
    expect(outcome.status).toBe("filled");
    expect(outcome.value).toBe("Pune, India");
  });

  it("marks unchanged when values already match", () => {
    const outcome = mergeField({
      key: "currentLocation",
      label: "Current location",
      existingValue: "Pune, India",
      incomingValue: "Pune, India",
      existingConfirmed: true,
    });
    expect(outcome.status).toBe("unchanged");
  });

  it("leaves an existing confirmed value alone when the resume has nothing", () => {
    const outcome = mergeField({
      key: "currentLocation",
      label: "Current location",
      existingValue: "Pune, India",
      incomingValue: null,
      existingConfirmed: true,
    });
    expect(outcome.status).toBe("unchanged");
    expect(outcome.value).toBe("Pune, India");
  });

  it("treats reordered array values as equal, not a conflict", () => {
    const outcome = mergeField({
      key: "requiredSkills",
      label: "Skills",
      existingValue: ["React", "TypeScript"],
      incomingValue: ["TypeScript", "React"],
      existingConfirmed: true,
    });
    expect(outcome.status).toBe("unchanged");
  });
});

describe("mergeProfileFields / applyConflictResolutions", () => {
  it("collects conflicts and resolves them per user choice", () => {
    const { outcomes, conflicts } = mergeProfileFields([
      {
        key: "currentLocation",
        label: "Current location",
        existingValue: "Bangalore, India",
        incomingValue: "Pune, India",
        existingConfirmed: true,
      },
      {
        key: "jobTitles",
        label: "Job titles",
        existingValue: null,
        incomingValue: ["Backend Engineer"],
        existingConfirmed: false,
      },
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].key).toBe("currentLocation");

    const resolved = applyConflictResolutions(outcomes, { currentLocation: "incoming" });
    expect(resolved.currentLocation).toBe("Pune, India");
    expect(resolved.jobTitles).toEqual(["Backend Engineer"]);
  });

  it("defaults unresolved conflicts to the existing (already-confirmed) value", () => {
    const { outcomes } = mergeProfileFields([
      {
        key: "currentLocation",
        label: "Current location",
        existingValue: "Bangalore, India",
        incomingValue: "Pune, India",
        existingConfirmed: true,
      },
    ]);
    const resolved = applyConflictResolutions(outcomes, {});
    expect(resolved.currentLocation).toBe("Bangalore, India");
  });
});
