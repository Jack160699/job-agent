import type { BrowserAutomationClient } from "./types";
import { withResilience } from "@/lib/automation/resilient";

export class ResilientBrowserClient implements BrowserAutomationClient {
  constructor(private inner: BrowserAutomationClient) {}

  async navigate(url: string) {
    return withResilience(() => this.inner.navigate(url), {
      label: "navigate",
      retries: 3,
    });
  }

  async snapshot() {
    return withResilience(() => this.inner.snapshot(), { label: "snapshot", retries: 2 });
  }

  async click(ref: string) {
    return withResilience(() => this.inner.click(ref), { label: "click", retries: 3 });
  }

  async fill(fields: Parameters<BrowserAutomationClient["fill"]>[0]) {
    return withResilience(() => this.inner.fill(fields), { label: "fill", retries: 2 });
  }

  async type(ref: string, text: string) {
    return withResilience(() => this.inner.type(ref, text), { label: "type", retries: 2 });
  }

  async select(ref: string, value: string) {
    return withResilience(() => this.inner.select(ref, value), { label: "select", retries: 2 });
  }

  async upload(ref: string, filePath: string) {
    return withResilience(() => this.inner.upload(ref, filePath), {
      label: "upload",
      retries: 2,
    });
  }

  async waitForSelector(selector: string, timeoutMs?: number) {
    return withResilience(
      () => this.inner.waitForSelector(selector, timeoutMs),
      { label: "wait", retries: 2 }
    );
  }

  async screenshot() {
    return this.inner.screenshot();
  }

  async close() {
    return this.inner.close();
  }
}
