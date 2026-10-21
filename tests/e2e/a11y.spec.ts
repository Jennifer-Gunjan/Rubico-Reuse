import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// WCAG 2.1 A and AA rules, including colour contrast. Any violation fails the test.
async function violations(page: import("@playwright/test").Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(" | ")})`);
}

test("login page has no accessibility violations", async ({ page }) => {
  await page.goto("/");
  expect(await violations(page)).toEqual([]);
});

test("login page with an error has no accessibility violations", async ({ page }) => {
  await page.goto("/?error=domain");
  expect(await violations(page)).toEqual([]);
});

test("login page is usable on a phone width without sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await violations(page)).toEqual([]);
});
