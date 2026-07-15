import { describe, expect, it } from "vitest";
import type { JobResultsView } from "@/lib/data/dashboard";

function viewFilter(view: JobResultsView) {
  if (view === "expired") return { status: "EXPIRED" };
  if (view === "excluded") return { status: "ARCHIVED" };
  if (view === "saved") return { savedAt: { not: null } };
  if (view === "imported") {
    return { status: "ACTIVE", imports: { some: true } };
  }
  if (view === "recommended") {
    return {
      status: "ACTIVE",
      classification: "STRONG",
    };
  }
  return {
    status: "ACTIVE",
    classification: "POSSIBLE",
  };
}

describe("job result view contracts", () => {
  it("keeps the six launch views distinct", () => {
    const views: JobResultsView[] = [
      "recommended",
      "possible",
      "saved",
      "imported",
      "excluded",
      "expired",
    ];
    const shapes = views.map((view) => JSON.stringify(viewFilter(view)));
    expect(new Set(shapes).size).toBe(6);
  });

  it("does not mix LOW classification into the Possible view", () => {
    expect(viewFilter("possible")).toEqual({
      status: "ACTIVE",
      classification: "POSSIBLE",
    });
  });

  it("keeps saved roles visible even if they later expire", () => {
    expect(viewFilter("saved")).toEqual({ savedAt: { not: null } });
  });
});
