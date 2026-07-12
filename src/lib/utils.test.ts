import { test, expect } from "vitest";
import { cn, formatCurrency, formatDate, getMatchScoreColor, truncate } from "@/lib/utils";

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

test("getMatchScoreColor returns correct colors", () => {
  expect(getMatchScoreColor(85)).toBe("text-emerald-400");
  expect(getMatchScoreColor(65)).toBe("text-amber-400");
  expect(getMatchScoreColor(40)).toBe("text-red-400");
});

test("truncate shortens long strings", () => {
  expect(truncate("hello world", 5)).toBe("hello...");
  expect(truncate("hi", 5)).toBe("hi");
});
