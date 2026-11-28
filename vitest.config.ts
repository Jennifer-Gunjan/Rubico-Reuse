import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    testTimeout: 30_000, // live tests call real Supabase over the network
    // tests/db builds a fresh in-process Postgres per test and replays every migration.
    // That is ~2s alone, but several files run in parallel, and the default 10s hook
    // timeout started being missed once the migration count grew. Setup time is not the
    // thing under test, so give it the same room as the tests themselves.
    hookTimeout: 30_000,
  },
});
