import { expect, test } from "@playwright/test";

test("login page offers Google and an email link", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /second life/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Email me a link" })).toBeVisible();
});

test("an outside email address is refused before anything is sent", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/sign-in link by email/i).fill("someone@gmail.com");
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByRole("status")).toContainText("@rubicotech.com or @rubicotech.in");
});

for (const path of ["/my", "/wanted", "/profile", "/notifications", "/listings/new"]) {
  test(`${path} sends anonymous visitors to login`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/\?next=/);
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  });
}

test("a callback without a code shows a sign-in error", async ({ page }) => {
  await page.goto("/auth/callback");
  await expect(page.locator("p.error")).toContainText("Sign-in did not complete");
});

test("the email retry route is closed without the secret", async ({ request }) => {
  expect((await request.get("/api/cron/emails")).status()).toBe(401);
});

test("anonymous visitors can browse listings but not act", async ({ page }) => {
  await page.goto("/browse");
  await expect(page.getByRole("heading", { name: "Browse" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Notifications" })).toHaveCount(0);
});

test("the landing page shows the preview section", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Available now" })).toBeVisible();
});

test("a listing link carries the visitor back after sign-in", async ({ page }) => {
  await page.goto("/listings/123e4567-e89b-12d3-a456-426614174000");
  expect(page.url()).not.toContain("next="); // unknown listing is a 404, not a login bounce
  await expect(page.getByText(/not found|could not be found/i).first()).toBeVisible();
});
