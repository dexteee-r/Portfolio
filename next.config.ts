import type { NextConfig } from "next";
import { pageSlugRedirects } from "./src/content/pages";

const isE2EBuild = process.env.NEXT_DIST_DIR === ".next-e2e";

const nextConfig: NextConfig = {
  // E2E builds against fixture content go to their own directory so they can
  // never be mistaken for, or overwrite, the real production build.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  typescript: {
    // An E2E build would also check the *other* build directory's generated
    // route types, stale after a route is removed. Types are checked by their
    // own step (npm run typecheck, in `check` and in CI); E2E tests behaviour.
    ignoreBuildErrors: isE2EBuild,
  },
  reactStrictMode: true,
  poweredByHeader: false,
  // Self-hosted: the build yields a self-contained Node server holding only
  // the files it needs — what the Docker image runs (see Dockerfile), and
  // what deploy/smoke-test.sh checks. E2E builds keep the regular output,
  // served by `next start`.
  output: isE2EBuild ? undefined : "standalone",
  // A frame page's slug under the wrong language (`/en/mentions-legales`)
  // goes to that language's own slug; see src/content/pages.ts.
  async redirects() {
    return pageSlugRedirects();
  },
  // The commit an image was built from, on every response: the deployment
  // checks that the site really serves the new version (deploy/wait-for-version.sh).
  async headers() {
    const version = process.env.ELMZN_VERSION?.trim();
    return version ? [{ source: "/:path*", headers: [{ key: "X-Elmzn-Version", value: version }] }] : [];
  },
  // Pages rendered on demand (the 404) read content/ at request time: ship it
  // with the server bundle, since file tracing cannot see dynamic fs reads.
  outputFileTracingIncludes: {
    "/**": ["./content/**/*"],
  },
  experimental: {
    // Every route is static (dynamicParams = false), so an unknown URL never
    // renders a page that then throws notFound() — which Next 16 answers with
    // an empty HTML shell filled in by the client. It gets a complete,
    // server-rendered 404 from app/global-not-found.tsx instead.
    globalNotFound: true,
  },
  images: {
    // AVIF first, WebP as fallback — no raw JPEG ever reaches the visitor.
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
