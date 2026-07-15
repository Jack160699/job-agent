export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

export function requireBrowserWorkerToken(): string {
  const token = process.env.BROWSER_WORKER_TOKEN?.trim();
  if (!token) {
    if (isProductionRuntime()) {
      throw new Error("BROWSER_WORKER_TOKEN is required in production");
    }
    return "";
  }
  return token;
}

export function verifyBrowserWorkerBearer(authHeader: string | null | undefined): boolean {
  const token = requireBrowserWorkerToken();
  if (!token) {
    return !isProductionRuntime();
  }
  const provided = authHeader?.replace(/^Bearer\s+/i, "").trim();
  return provided === token;
}

export function getBrowserMcpBindHost(): string {
  if (process.env.BROWSER_MCP_BIND_HOST) {
    return process.env.BROWSER_MCP_BIND_HOST;
  }
  return isProductionRuntime() ? "127.0.0.1" : "0.0.0.0";
}
