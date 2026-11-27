// Accessibility and phone-width checks on the signed-in pages. Runs only when the E2E_* variables are set (CI journey job).
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signIn } from "./auth";

const { E2E_EMAIL, E2E_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = process.env;
const PAGES = ["/browse", "/browse?q=desk&category=Furniture", "/wanted", "/wanted/new", "/my", "/profile", "/notifications", "/listings/new"];

// A 1x1 PNG, so the listing under test has a photo and the gallery dialog actually opens.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64");

/** Posts a listing with one photo and returns its path, so the two busiest pages can be swept. */
async function postListing(page: import("@playwright/test").Page): Promise<string> {
  await page.goto("/listings/new");
  await page.waitForLoadState("networkidle"); // let it hydrate, or React resets the fields
  await page.getByLabel("Title").fill(`[E2E] a11y ${Date.now()}`);
  await page.getByLabel("Description").fill("Checked for accessibility.");
  await page.getByLabel("Category").selectOption("Other");
  await page.getByLabel("Condition").selectOption("good");
  await page.locator('input[type="file"]').setInputFiles({ name: "p.png", mimeType: "image/png", buffer: PIXEL });
  await page.getByRole("button", { name: "Post item" }).click();
  await page.waitForURL(/\/listings\/[0-9a-f-]{36}/);
  return new URL(page.url()).pathname;
}

test.describe("signed-in pages", () => {
  test.skip(!(E2E_EMAIL && E2E_PASSWORD && NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_ANON_KEY), "E2E credentials not set");

  for (const width of [1280, 375]) {
    test(`no WCAG A/AA violations and no sideways scroll at ${width}px`, async ({ browser, baseURL }) => {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      await signIn(ctx, baseURL!, E2E_EMAIL!, E2E_PASSWORD!);
      const page = await ctx.newPage();
      const problems: string[] = [];

      // The listing page and its edit form hold the photo dialog, the request panel and the
      // report form - the most interactive screens in the product, and the ones the sweep
      // did not cover. They need a real listing, so post one first.
      const listing = await postListing(page);

      for (const path of [...PAGES, listing, `${listing}/edit`]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        for (const v of r.violations) problems.push(`${path} ${v.id}: ${v.help} (${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")})`);
        if (!(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))) problems.push(`${path} scrolls sideways`);
      }
      // The photo dialog is the single most complex interactive element here: a <dialog>
      // with its own arrow-key handling. It is only reachable once a listing has a photo.
      await page.goto(listing);
      await page.waitForLoadState("networkidle");
      const thumb = page.locator("button.thumbbtn").first();
      if (await thumb.count()) {
        await thumb.click();
        await page.waitForTimeout(400);
        const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        for (const v of r.violations) problems.push(`photo dialog ${v.id}: ${v.help}`);
      } else {
        problems.push("photo dialog was never opened: the listing has no photo");
      }

      expect(problems).toEqual([]);
    });
  }
});
