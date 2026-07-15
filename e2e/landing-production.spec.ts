import path from "node:path";
import { expect, test } from "@playwright/test";

const viewports = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 15", width: 393, height: 852 },
  { name: "Pixel-class Android", width: 412, height: 915 },
  { name: "Samsung-class Android", width: 360, height: 800 },
  { name: "iPad", width: 768, height: 1024 },
  { name: "1366 laptop", width: 1366, height: 768 },
  { name: "1440 desktop", width: 1440, height: 1000 },
  { name: "ultrawide", width: 1920, height: 1080 },
] as const;

test.describe("Kairela production homepage", () => {
  for (const viewport of viewports) {
    test(`${viewport.name} renders without clipping or runtime errors`, async ({ page }) => {
      const runtimeErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") runtimeErrors.push(message.text());
      });
      page.on("pageerror", (error) => runtimeErrors.push(error.message));

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/", { waitUntil: "networkidle" });

      await expect(page.getByRole("heading", { level: 1 })).toContainText("Kairela");
      await expect(page.getByRole("link", { name: "Start free", exact: true }).first()).toHaveAttribute("href", "/signup");

      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        headerBottom: document.querySelector("header")?.getBoundingClientRect().bottom ?? 0,
        headingTop: document.querySelector("h1")?.getBoundingClientRect().top ?? 0,
      }));

      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
      expect(dimensions.headingTop).toBeGreaterThan(dimensions.headerBottom);
      expect(runtimeErrors).toEqual([]);

      if (viewport.name === "iPhone 15" || viewport.name === "1440 desktop") {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.evaluate(async () => {
          const step = Math.max(window.innerHeight * 0.8, 500);
          for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          }
          window.scrollTo(0, 0);
        });
        await expect(page.getByRole("progressbar", { name: "Kairela demonstration progress" })).toBeVisible();
        await page.addStyleTag({
          content: ".landing-page main > section { content-visibility: visible !important; }",
        });

        const filename = viewport.name === "iPhone 15"
          ? "kairela-homepage-mobile-production.png"
          : "kairela-homepage-desktop-production.png";
        await page.screenshot({
          path: path.join(process.cwd(), "screenshots", filename),
          fullPage: true,
          animations: "disabled",
        });
      }
    });
  }
});
