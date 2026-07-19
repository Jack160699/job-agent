import { test, expect } from "vitest";
import {
  cn,
  formatCurrency,
  formatDate,
  formatIndiaDateTime,
  getMatchScoreColor,
  truncate,
} from "@/lib/utils";

test("cn merges class names", () => {
  expect(cn("foo", "bar")).toBe("foo bar");
  expect(cn("px-2", "px-4")).toBe("px-4");
});

test("formatCurrency formats USD", () => {
  expect(formatCurrency(100000)).toBe("$100,000");
});

test("formatDate formats dates", () => {
  const result = formatDate("2026-01-15");
  expect(result).toContain("2026");
});

test("formatIndiaDateTime is deterministic across server and browser time zones", () => {
  expect(formatIndiaDateTime("2026-07-19T20:30:00.000Z")).toBe(
    "20/07/2026, 02:00 IST"
  );
  expect(formatIndiaDateTime("not-a-date")).toBe("Unknown");
});

test("getMatchScoreColor returns correct colors", () => {
  expect(getMatchScoreColor(85)).toBe("text-[var(--success)]");
  expect(getMatchScoreColor(65)).toBe("text-[var(--warning)]");
  expect(getMatchScoreColor(40)).toBe("text-[var(--error)]");
});

test("truncate shortens long strings", () => {
  expect(truncate("hello world", 5)).toBe("hello...");
  expect(truncate("hi", 5)).toBe("hi");
});
