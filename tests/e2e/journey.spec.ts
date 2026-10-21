// Two real accounts walk through post, request, accept and handover against the live Supabase project.
// Runs only when the E2E_* variables are set (CI sets them from secrets).
import { expect, test } from "@playwright/test";
import { signIn } from "./auth";

const { E2E_EMAIL, E2E_PASSWORD, E2E_EMAIL_2, E2E_PASSWORD_2, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = process.env;
const ready = !!(E2E_EMAIL && E2E_PASSWORD && E2E_EMAIL_2 && E2E_PASSWORD_2 && NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_ANON_KEY);

test.describe("journey", () => {
  test.skip(!ready, "E2E credentials not set");
  test.describe.configure({ mode: "serial" });

  test("giver posts, seeker requests, giver accepts, both see contact, giver marks given", async ({ browser, baseURL }) => {
    const title = `[E2E] desk ${Date.now()}`;
    const giverCtx = await browser.newContext();
    const seekerCtx = await browser.newContext();
    await signIn(giverCtx, baseURL!, E2E_EMAIL!, E2E_PASSWORD!);
    await signIn(seekerCtx, baseURL!, E2E_EMAIL_2!, E2E_PASSWORD_2!);
    const giver = await giverCtx.newPage();
    const seeker = await seekerCtx.newPage();

    // Giver posts a donation.
    await giver.goto("/listings/new");
    await giver.getByLabel("Title").fill(title);
    await giver.getByLabel("Description").fill("Automated test item");
    await giver.getByLabel("Category").selectOption("Furniture");
    await giver.getByLabel("Condition").selectOption("good");
    await giver.getByRole("button", { name: "Post item" }).click();
    await expect(giver).toHaveURL(/\/listings\/[0-9a-f-]{36}$/);
    const listingUrl = giver.url();

    // It shows up in search.
    await seeker.goto(`/browse?q=${encodeURIComponent(title)}`);
    await expect(seeker.getByRole("heading", { name: title })).toBeVisible();

    // Seeker requests it.
    await seeker.goto(listingUrl);
    await seeker.getByLabel("Message to the giver").fill("I would like this, thank you");
    await seeker.getByRole("button", { name: "Send request" }).click();
    await expect(seeker.getByText("You requested this item")).toBeVisible();

    // Giver accepts and sees the seeker's contact.
    await giver.goto(listingUrl);
    await expect(giver.getByText("I would like this, thank you")).toBeVisible();
    await giver.getByRole("button", { name: "Accept" }).click();
    await expect(giver.getByText(/You accepted/)).toBeVisible();
    await expect(giver.getByRole("status")).toContainText(E2E_EMAIL_2!);

    // Seeker now sees the giver's contact.
    await seeker.goto(listingUrl);
    await expect(seeker.getByText("Your request was accepted")).toBeVisible();
    await expect(seeker.getByRole("status")).toContainText(E2E_EMAIL!);

    // Handover done.
    await giver.getByRole("button", { name: "Mark as given" }).click();
    await expect(giver.getByText(/has been given/)).toBeVisible();
    await seeker.goto(`/browse?q=${encodeURIComponent(title)}`);
    await expect(seeker.getByRole("heading", { name: title })).toHaveCount(0);
  });

  test("a banned item cannot be posted", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext();
    await signIn(ctx, baseURL!, E2E_EMAIL!, E2E_PASSWORD!);
    const page = await ctx.newPage();
    await page.goto("/listings/new");
    await page.getByLabel("Title").fill("Spare medicines");
    await page.getByLabel("Description").fill("Leftover strips");
    await page.getByLabel("Category").selectOption("Other");
    await page.getByLabel("Condition").selectOption("good");
    await page.getByRole("button", { name: "Post item" }).click();
    await expect(page.locator("p.error")).toContainText("cannot be listed");
    await expect(page).toHaveURL(/\/listings\/new$/);
  });
});
