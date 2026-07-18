import { describe, expect, it } from "vitest";
import {
  isSeniorityCompatible,
  locationsAreCompatible,
  normalizeLocation,
  normalizeTitle,
  seniorityForExperience,
  titlesAreRelated,
} from "./normalization";

describe("India-first location normalization", () => {
  it.each([
    ["Bengaluru", "Bangalore"],
    ["Delhi NCR", "Gurugram"],
    ["Delhi NCR", "Noida"],
    ["Mumbai", "Navi Mumbai"],
    ["Chandigarh", "Mohali"],
    ["Kochi", "Ernakulam"],
  ])("treats %s and %s as the same area", (preferred, actual) => {
    expect(
      locationsAreCompatible([preferred], actual, {
        remotePreferred: false,
        willingToRelocate: false,
      }).matched
    ).toBe(true);
  });

  it("never replaces Pune with San Francisco", () => {
    const result = locationsAreCompatible(["Pune"], "San Francisco, CA", {
      remotePreferred: false,
      willingToRelocate: false,
    });
    expect(result.matched).toBe(false);
    expect(result.reason).toContain("outside preferred locations");
  });

  it("distinguishes India remote from unconfirmed worldwide remote", () => {
    expect(
      locationsAreCompatible(["Pune", "India"], "Remote - India", {
        remotePreferred: true,
        willingToRelocate: false,
      }).matched
    ).toBe(true);
    expect(
      locationsAreCompatible(["Pune"], "Worldwide Remote", {
        remotePreferred: true,
        willingToRelocate: false,
      }).matched
    ).toBe(false);
  });

  it("recognizes tier-2 Indian cities", () => {
    expect(normalizeLocation("Remote - Indore, India").country).toBe("IN");
  });

  it("recognizes PCMC and Pimpri-Chinchwad as the Pune area", () => {
    expect(normalizeLocation("PCMC, Pune").group).toBe("pune");
    expect(normalizeLocation("Pimpri-Chinchwad, Maharashtra").group).toBe("pune");
    expect(
      locationsAreCompatible(["Pune"], "PCMC, Maharashtra", {
        remotePreferred: false,
        willingToRelocate: false,
      }).matched
    ).toBe(true);
  });

  it("surfaces a state-only posting as an uncertain — not silent — match", () => {
    const result = locationsAreCompatible(["Pune"], "Maharashtra, India", {
      remotePreferred: false,
      willingToRelocate: false,
    });
    expect(result.matched).toBe(true);
    expect(result.uncertain).toBe(true);
    expect(result.reason).toContain("unconfirmed");
  });

  it("does not treat a different state as a Pune match", () => {
    const result = locationsAreCompatible(["Pune"], "Karnataka, India", {
      remotePreferred: false,
      willingToRelocate: false,
    });
    expect(result.matched).toBe(false);
  });

  it("hard-excludes remote roles explicitly restricted to a non-India location", () => {
    const result = locationsAreCompatible(["Pune", "India"], "Remote - US Only", {
      remotePreferred: true,
      willingToRelocate: false,
    });
    expect(result.matched).toBe(false);
    expect(result.uncertain).toBeFalsy();
    expect(result.reason).toContain("restricted");
  });
});

describe("role and seniority normalization", () => {
  it.each([
    ["Software Developer", "Software Engineer"],
    ["Frontend Developer", "React Developer"],
    ["Operations Analyst", "Business Operations Analyst"],
    ["Technical Support", "Application Support"],
    ["HR Executive", "Talent Acquisition Executive"],
  ])("recognizes %s and %s as adjacent titles", (target, candidate) => {
    expect(titlesAreRelated(target, candidate)).toBe(true);
  });

  it("does not make unrelated roles adjacent", () => {
    expect(titlesAreRelated("Software Engineer", "Sales Executive")).toBe(false);
  });

  it("blocks lead roles for fresh graduates", () => {
    expect(
      isSeniorityCompatible(
        seniorityForExperience(0),
        normalizeTitle("Lead Software Engineer").seniority,
        false
      ).compatible
    ).toBe(false);
  });

  it("blocks internships unless explicitly selected", () => {
    expect(isSeniorityCompatible("MID", "INTERN", false).compatible).toBe(false);
    expect(isSeniorityCompatible("MID", "INTERN", true).compatible).toBe(true);
  });
});
