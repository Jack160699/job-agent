import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getBrowserMcpBindHost,
  requireBrowserWorkerToken,
  verifyBrowserWorkerBearer,
} from "./browser-worker-auth";

describe("browser-worker-auth", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires token in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.BROWSER_WORKER_TOKEN;
    expect(() => requireBrowserWorkerToken()).toThrow(/required in production/);
  });

  it("allows missing token in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.BROWSER_WORKER_TOKEN;
    expect(requireBrowserWorkerToken()).toBe("");
  });

  it("verifies bearer token", () => {
    vi.stubEnv("BROWSER_WORKER_TOKEN", "secret-token");
    expect(verifyBrowserWorkerBearer("Bearer secret-token")).toBe(true);
    expect(verifyBrowserWorkerBearer("Bearer wrong")).toBe(false);
    expect(verifyBrowserWorkerBearer(null)).toBe(false);
  });

  it("binds MCP bridge to localhost in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(getBrowserMcpBindHost()).toBe("127.0.0.1");
  });
});
