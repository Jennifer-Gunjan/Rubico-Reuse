import { defineConfig } from "@playwright/test";

const port = 3100;
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 }, // real server actions on Supabase can take more than the default 5s
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${port}`,
    trace: "retain-on-failure",
    // Local sandboxes ship their own Chromium; CI uses `playwright install`.
    launchOptions: process.env.PW_EXECUTABLE ? { executablePath: process.env.PW_EXECUTABLE } : {},
  },
  // Start the built app unless testing a deployed URL.
  webServer: process.env.E2E_BASE_URL ? undefined : { command: `npx next start -p ${port}`, port, reuseExistingServer: !process.env.CI, timeout: 60_000 },
});
