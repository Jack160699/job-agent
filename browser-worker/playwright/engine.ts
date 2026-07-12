import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import type {
  BrowserElement,
  BrowserSnapshot,
  FillField,
} from "../../src/lib/browser/types";

export interface ExtractResult {
  text: string;
  fields: Record<string, string>;
}

interface Session {
  browser: import("playwright-core").Browser;
  page: import("playwright-core").Page;
}

export class PlaywrightEngine {
  private sessions = new Map<string, Session>();
  private screenshotDir: string;
  private defaultSessionId = "default";

  constructor(screenshotDir?: string) {
    this.screenshotDir =
      screenshotDir || join(process.cwd(), "browser-worker", "screenshots");
  }

  private async ensureSession(sessionId = this.defaultSessionId): Promise<Session> {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;

    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({
      headless: process.env.BROWSER_HEADLESS !== "false",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    const session = { browser, page };
    this.sessions.set(sessionId, session);
    return session;
  }

  async open(sessionId?: string) {
    await this.ensureSession(sessionId);
    return { sessionId: sessionId || this.defaultSessionId, ok: true };
  }

  async goto(url: string, sessionId?: string) {
    const { page } = await this.ensureSession(sessionId);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    return { url: page.url(), title: await page.title() };
  }

  async snapshot(sessionId?: string): Promise<BrowserSnapshot & { yaml: string }> {
    const { page } = await this.ensureSession(sessionId);
    const url = page.url();
    const title = await page.title();
    const elements = await page.evaluate(() => {
      const results: BrowserElement[] = [];
      let i = 0;
      const selectors =
        'a, button, input, textarea, select, [role="button"], [role="link"], label, [type="file"]';
      document.querySelectorAll(selectors).forEach((el) => {
        const role =
          el.getAttribute("role") || el.tagName.toLowerCase();
        const name =
          (el as HTMLElement).innerText?.trim().slice(0, 120) ||
          el.getAttribute("aria-label") ||
          el.getAttribute("name") ||
          el.getAttribute("placeholder") ||
          el.getAttribute("id") ||
          "";
        if (
          !name &&
          el.tagName !== "INPUT" &&
          el.tagName !== "TEXTAREA" &&
          el.tagName !== "SELECT"
        )
          return;
        const ref = `e${i}`;
        results.push({
          ref,
          role,
          name,
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute("type") || undefined,
          value: (el as HTMLInputElement).value || undefined,
        });
        (el as HTMLElement).dataset.browserRef = ref;
        i++;
      });
      return results;
    });

    const yaml = [
      `Page URL: ${url}`,
      `Page Title: ${title}`,
      ...elements.map(
        (el) =>
          `- ${el.role}${el.name ? ` "${el.name.replace(/"/g, "'")}"` : ""} [ref=${el.ref}]`
      ),
    ].join("\n");

    return { url, title, elements, yaml };
  }

  async click(ref: string, sessionId?: string) {
    const { page } = await this.ensureSession(sessionId);
    await this.clickWithFallback(page, ref);
    return { ok: true };
  }

  private async clickWithFallback(
    page: import("playwright-core").Page,
    ref: string
  ) {
    const selectors = [
      `[data-browser-ref="${ref}"]`,
      ref.startsWith("#") || ref.startsWith(".") ? ref : `#${ref}`,
    ];
    for (const sel of selectors) {
      try {
        await page.click(sel, { timeout: 5000 });
        return;
      } catch {
        continue;
      }
    }
    throw new Error(`Could not click element: ${ref}`);
  }

  async type(ref: string, text: string, sessionId?: string) {
    const { page } = await this.ensureSession(sessionId);
    await page.fill(`[data-browser-ref="${ref}"]`, text);
    return { ok: true };
  }

  async fill(fields: FillField[], sessionId?: string) {
    const { page } = await this.ensureSession(sessionId);
    for (const field of fields) {
      if (field.ref) {
        await page.fill(`[data-browser-ref="${field.ref}"]`, field.value);
        continue;
      }
      if (field.label) {
        await page.getByLabel(field.label, { exact: false }).fill(field.value);
        continue;
      }
      if (field.name) {
        await page.fill(`[name="${field.name}"]`, field.value);
      }
    }
    return { ok: true };
  }

  async select(ref: string, value: string, sessionId?: string) {
    const { page } = await this.ensureSession(sessionId);
    await page.selectOption(`[data-browser-ref="${ref}"]`, value);
    return { ok: true };
  }

  async upload(ref: string, filePath: string, sessionId?: string) {
    const { page } = await this.ensureSession(sessionId);
    const fileInput = page.locator(`[data-browser-ref="${ref}"]`);
    if ((await fileInput.count()) > 0) {
      await fileInput.setInputFiles(filePath);
      return { ok: true };
    }
    await page.setInputFiles('input[type="file"]', filePath);
    return { ok: true };
  }

  async wait(selector: string, timeoutMs = 15000, sessionId?: string) {
    const { page } = await this.ensureSession(sessionId);
    try {
      await page.waitForSelector(selector, { timeout: timeoutMs });
      return { ok: true, method: "selector" };
    } catch {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const snap = await this.snapshot(sessionId);
        if (
          snap.elements.some(
            (e) =>
              e.name.toLowerCase().includes(selector.toLowerCase()) ||
              e.role.toLowerCase().includes(selector.toLowerCase())
          )
        ) {
          return { ok: true, method: "snapshot" };
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      throw new Error(`Wait timeout: ${selector}`);
    }
  }

  async screenshot(sessionId?: string, label?: string) {
    const { page } = await this.ensureSession(sessionId);
    await mkdir(this.screenshotDir, { recursive: true });
    const buffer = await page.screenshot({ fullPage: false });
    const filename = `${Date.now()}-${label || "screenshot"}.png`;
    const filepath = join(this.screenshotDir, filename);
    await writeFile(filepath, buffer);
    return {
      data: buffer.toString("base64"),
      path: filepath,
      filename,
    };
  }

  async extract(selector?: string, sessionId?: string): Promise<ExtractResult> {
    const { page } = await this.ensureSession(sessionId);
    if (selector) {
      const text = await page.locator(selector).innerText().catch(() => "");
      return { text, fields: {} };
    }
    const fields = await page.evaluate(() => {
      const out: Record<string, string> = {};
      document.querySelectorAll("input, textarea, select").forEach((el) => {
        const name =
          el.getAttribute("name") ||
          el.getAttribute("aria-label") ||
          el.getAttribute("placeholder") ||
          el.id;
        if (!name) return;
        out[name] = (el as HTMLInputElement).value || "";
      });
      return out;
    });
    const text = await page.evaluate(() => document.body.innerText.slice(0, 5000));
    return { text, fields };
  }

  async submit(sessionId?: string) {
    const { page } = await this.ensureSession(sessionId);
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Submit")',
      'button:has-text("Apply")',
    ];
    for (const sel of submitSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2000 })) {
          await btn.click();
          return { ok: true, selector: sel };
        }
      } catch {
        continue;
      }
    }
    throw new Error("Submit button not found");
  }

  async close(sessionId?: string) {
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        await session.page.close();
        await session.browser.close();
        this.sessions.delete(sessionId);
      }
      return { ok: true };
    }
    for (const [, session] of this.sessions) {
      await session.page.close();
      await session.browser.close();
    }
    this.sessions.clear();
    return { ok: true };
  }
}
