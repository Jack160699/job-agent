import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function prepareLongPageForCapture(page: import("@playwright/test").Page) {
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
}

test.describe("Kairela public homepage", () => {
  test("tells the complete product story with working primary links", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Kairela/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Kairela");
    await expect(page.getByRole("heading", { name: /Find roles that actually fit/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Every application, prepared around you/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /A career partner that keeps helping/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /See Kairela think through your next move/i })).toBeVisible();

    const signupLinks = page.getByRole("link", { name: /Start free/i });
    expect(await signupLinks.count()).toBeGreaterThan(0);
    await expect(signupLinks.first()).toHaveAttribute("href", "/signup");
    await expect(page.getByRole("link", { name: "Log in", exact: true }).first()).toHaveAttribute("href", "/login");

    for (const id of ["how-it-works", "job-seekers", "employers", "career-partner", "pricing"]) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
  });

  test("has no serious or critical automated accessibility violations", async ({ page }) => {
    await page.goto("/");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((violation) =>
      violation.impact === "serious" || violation.impact === "critical"
    );
    expect(blocking).toEqual([]);
  });

  test("supports keyboard entry and a visible skip link", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
  });

  test("mobile navigation is opaque and the hero stays within 375px and 414px viewports", async ({ page }) => {
    for (const width of [375, 414]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/");

      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        headerBottom: document.querySelector("header")?.getBoundingClientRect().bottom ?? 0,
        heading: document.querySelector("h1")?.getBoundingClientRect(),
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
      expect(dimensions.heading?.top ?? 0).toBeGreaterThan(dimensions.headerBottom);
      expect(dimensions.heading?.right ?? width + 1).toBeLessThanOrEqual(width);

      const menuButton = page.getByRole("button", { name: "Open navigation" });
      await expect(menuButton).toHaveCSS("width", "44px");
      await expect(menuButton).toHaveCSS("height", "44px");
      await menuButton.click();

      const backdrop = page.locator(".landing-mobile-sheet-backdrop");
      await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
      await expect(page.getByRole("link", { name: "For job seekers", exact: true })).toBeVisible();
      await expect(backdrop).toHaveCSS("background-color", "rgb(251, 250, 245)");

      const overlay = await backdrop.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom };
      });
      expect(overlay).toEqual({ top: 0, left: 0, right: width, bottom: 812 });

      await page
        .getByRole("navigation", { name: "Mobile navigation" })
        .getByRole("button", { name: "Close navigation" })
        .click();
      await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toHaveCount(0);
    }
  });

  test("the illustrative thinking sequence can be replayed", async ({ page }) => {
    await page.goto("/#thinking-title");
    const demo = page.getByTestId("thinking-demo");
    await demo.scrollIntoViewIfNeeded();
    const progress = demo.getByRole("progressbar", { name: "Kairela demonstration progress" });
    await expect(progress).toBeVisible();
    await expect.poll(async () => Number(await progress.getAttribute("aria-valuenow"))).toBeGreaterThan(1);
    await demo.getByRole("button", { name: "Replay" }).click();
    await expect(progress).toHaveAttribute("aria-valuenow", "1");
    await expect(demo.getByText("No real application is being processed or submitted.")).toBeVisible();
  });

  test("reduced motion keeps content readable and stops automatic demo progress", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByTestId("thinking-demo").scrollIntoViewIfNeeded();
    const progress = page.getByRole("progressbar", { name: "Kairela demonstration progress" });
    await expect(progress).toHaveAttribute("aria-valuenow", "1");
    await page.waitForTimeout(1_300);
    await expect(progress).toHaveAttribute("aria-valuenow", "1");
    await expect(page.getByText("Discover", { exact: true }).first()).toBeVisible();
  });

  test("trust destinations and authentication pages resolve", async ({ request }) => {
    for (const path of ["/privacy", "/terms", "/cookies", "/ai-disclosure", "/data-deletion", "/login", "/signup"]) {
      const response = await request.get(path);
      expect(response.ok(), `${path} should resolve`).toBeTruthy();
    }
  });
});

test.describe("Kairela homepage visual baselines", () => {
  test("desktop 1440", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await prepareLongPageForCapture(page);
    await expect(page).toHaveScreenshot("landing-desktop-1440.png", {
      fullPage: true,
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    });
  });

  test("mobile 393", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await prepareLongPageForCapture(page);
    await expect(page).toHaveScreenshot("landing-mobile-393.png", {
      fullPage: true,
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    });
  });
});
