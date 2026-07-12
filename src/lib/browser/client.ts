import type {
  BrowserAutomationClient,
  BrowserElement,
  BrowserSnapshot,
  FillField,
} from "./types";
import { ResilientBrowserClient } from "./resilient-client";

function parseSnapshotYaml(yaml: string): BrowserSnapshot {
  const lines = yaml.split("\n");
  const elements: BrowserElement[] = [];
  let url = "";
  let title = "";
  let refCounter = 0;

  for (const line of lines) {
    const urlMatch = line.match(/Page URL:\s*(.+)/);
    if (urlMatch) url = urlMatch[1].trim();

    const titleMatch = line.match(/Page Title:\s*(.+)/);
    if (titleMatch) title = titleMatch[1].trim();

    const roleMatch = line.match(
      /^\s*-\s+(\w+)(?:\s+"([^"]*)")?(?:\s+\[ref=([^\]]+)\])?/
    );
    if (roleMatch) {
      elements.push({
        ref: roleMatch[3] || `e${refCounter++}`,
        role: roleMatch[1],
        name: roleMatch[2] || "",
      });
    }
  }

  return { url, title, elements };
}

export class PlaywrightBrowserClient implements BrowserAutomationClient {
  private browser: import("playwright-core").Browser | null = null;
  private page: import("playwright-core").Page | null = null;

  private async ensurePage() {
    if (this.page) return this.page;
    const { chromium } = await import("playwright-core");
    this.browser = await chromium.launch({
      headless: process.env.BROWSER_HEADLESS !== "false",
    });
    this.page = await this.browser.newPage();
    return this.page;
  }

  async navigate(url: string) {
    const page = await this.ensurePage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  }

  async snapshot(): Promise<BrowserSnapshot> {
    const page = await this.ensurePage();
    const url = page.url();
    const title = await page.title();
    const elements = await page.evaluate(() => {
      const results: BrowserElement[] = [];
      let i = 0;
      const selectors =
        'a, button, input, textarea, select, [role="button"], [role="link"], label';
      document.querySelectorAll(selectors).forEach((el) => {
        const role =
          el.getAttribute("role") ||
          el.tagName.toLowerCase();
        const name =
          (el as HTMLElement).innerText?.trim().slice(0, 120) ||
          el.getAttribute("aria-label") ||
          el.getAttribute("name") ||
          el.getAttribute("placeholder") ||
          "";
        if (!name && el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") return;
        results.push({
          ref: `e${i++}`,
          role,
          name,
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute("type") || undefined,
          value: (el as HTMLInputElement).value || undefined,
        });
        (el as HTMLElement).dataset.browserRef = `e${i - 1}`;
      });
      return results;
    });
    return { url, title, elements };
  }

  async click(ref: string) {
    const page = await this.ensurePage();
    await page.click(`[data-browser-ref="${ref}"]`, { timeout: 10000 });
  }

  async fill(fields: FillField[]) {
    const page = await this.ensurePage();
    for (const field of fields) {
      if (field.ref) {
        await page.fill(`[data-browser-ref="${field.ref}"]`, field.value);
        continue;
      }
      if (field.label) {
        const locator = page.getByLabel(field.label, { exact: false });
        await locator.fill(field.value, { timeout: 5000 });
        continue;
      }
      if (field.name) {
        await page.fill(`[name="${field.name}"]`, field.value);
      }
    }
  }

  async type(ref: string, text: string) {
    const page = await this.ensurePage();
    await page.fill(`[data-browser-ref="${ref}"]`, text);
  }

  async select(ref: string, value: string) {
    const page = await this.ensurePage();
    await page.selectOption(`[data-browser-ref="${ref}"]`, value);
  }

  async upload(ref: string, filePath: string) {
    const page = await this.ensurePage();
    await page.setInputFiles(`[data-browser-ref="${ref}"]`, filePath);
  }

  async waitForSelector(selector: string, timeoutMs = 15000) {
    const page = await this.ensurePage();
    try {
      await page.waitForSelector(selector, { timeout: timeoutMs });
      return;
    } catch {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const snap = await this.snapshot();
        if (
          snap.elements.some((e) =>
            e.name.toLowerCase().includes(selector.toLowerCase())
          )
        ) {
          return;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      throw new Error(`Selector not found: ${selector}`);
    }
  }

  async screenshot(): Promise<Buffer> {
    const page = await this.ensurePage();
    return page.screenshot({ fullPage: false });
  }

  async close() {
    await this.page?.close();
    await this.browser?.close();
    this.page = null;
    this.browser = null;
  }
}

/** MCP-compatible adapter — maps to cursor-ide-browser tool semantics */
export class MCPBrowserBridge implements BrowserAutomationClient {
  constructor(
    private invoke: (tool: string, args: Record<string, unknown>) => Promise<unknown>
  ) {}

  async navigate(url: string) {
    await this.invoke("browser_navigate", { url });
  }

  async snapshot(): Promise<BrowserSnapshot> {
    const result = (await this.invoke("browser_snapshot", {})) as {
      yaml?: string;
      content?: string;
    };
    const yaml = result.yaml || result.content || "";
    return parseSnapshotYaml(yaml);
  }

  async click(ref: string) {
    await this.invoke("browser_click", { ref });
  }

  async fill(fields: FillField[]) {
    for (const field of fields) {
      if (field.ref) {
        await this.invoke("browser_fill", { ref: field.ref, value: field.value });
      }
    }
  }

  async type(ref: string, text: string) {
    await this.invoke("browser_type", { ref, text });
  }

  async select(ref: string, value: string) {
    await this.invoke("browser_select_option", { ref, value });
  }

  async upload(ref: string, filePath: string) {
    await this.invoke("browser_fill", { ref, value: filePath });
  }

  async waitForSelector(selector: string, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const snap = await this.snapshot();
      if (snap.elements.some((e) => e.name.includes(selector))) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`Selector not found: ${selector}`);
  }

  async screenshot(): Promise<Buffer> {
    const result = (await this.invoke("browser_take_screenshot", {})) as {
      data?: string;
    };
    if (result.data) return Buffer.from(result.data, "base64");
    return Buffer.alloc(0);
  }

  async close() {
    await this.invoke("browser_lock", { action: "unlock" });
  }
}

export async function createBrowserClient(): Promise<BrowserAutomationClient> {
  let client: BrowserAutomationClient;
  if (process.env.BROWSER_MCP_BRIDGE_URL) {
    const bridgeUrl = process.env.BROWSER_MCP_BRIDGE_URL;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.BROWSER_WORKER_TOKEN) {
      headers.Authorization = `Bearer ${process.env.BROWSER_WORKER_TOKEN}`;
    }
    client = new MCPBrowserBridge(async (tool, args) => {
      const res = await fetch(`${bridgeUrl}/${tool}`, {
        method: "POST",
        headers,
        body: JSON.stringify(args),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Bridge error: ${res.status}`);
      }
      return res.json();
    });
  } else {
    client = new PlaywrightBrowserClient();
  }
  return new ResilientBrowserClient(client);
}
