// Accessibility and phone-width checks on the signed-in pages. Runs only when the E2E_* variables are set (CI journey job).
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signIn } from "./auth";

const { E2E_EMAIL, E2E_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = process.env;
const PAGES = ["/browse", "/browse?q=desk&category=Furniture", "/wanted", "/wanted/new", "/my", "/profile", "/notifications", "/listings/new"];

test.describe("signed-in pages", () => {
  test.skip(!(E2E_EMAIL && E2E_PASSWORD && NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_ANON_KEY), "E2E credentials not set");

  for (const width of [1280, 375]) {
    test(`no WCAG A/AA violations and no sideways scroll at ${width}px`, async ({ browser, baseURL }) => {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      await signIn(ctx, baseURL!, E2E_EMAIL!, E2E_PASSWORD!);
      const page = await ctx.newPage();
      const problems: string[] = [];
      for (const path of PAGES) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        for (const v of r.violations) problems.push(`${path} ${v.id}: ${v.help} (${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")})`);
        if (!(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))) problems.push(`${path} scrolls sideways`);
      }
      expect(problems).toEqual([]);
    });
  }
});
