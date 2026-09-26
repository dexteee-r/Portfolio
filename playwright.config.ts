import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

/**
 * E2E runs against a production build (`next build && next start`), never the
 * dev server: what we test is what ships. Content comes from the fixtures
 * directory so tests never depend on the real, moving content.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    // Every test starts as a returning visitor: the boot sequence already
    // seen. tests/e2e/boot.spec.ts starts from empty storage on purpose.
    storageState: {
      cookies: [],
      origins: [{ origin: baseURL, localStorage: [{ name: "elmzn.boot", value: "seen" }] }],
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      CONTENT_DIR: "tests/fixtures/content",
      NEXT_DIST_DIR: ".next-e2e",
      // A CMS pointed at a placeholder repository: enough to boot the panel
      // and exercise the OAuth endpoints, never able to reach a real one.
      // Every CMS variable is set here, so a developer's .env.local (which
      // `next start` would read) never changes what the tests see.
      CMS_GITHUB_REPO: "example/elmzn",
      CMS_GITHUB_BRANCH: "main",
      CMS_GITHUB_SCOPE: "repo",
      CMS_GITHUB_CLIENT_ID: "e2e-client-id",
      CMS_GITHUB_CLIENT_SECRET: "e2e-client-secret",
    },
  },
});
