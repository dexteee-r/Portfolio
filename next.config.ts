import type { NextConfig } from "next";
import { chapterSlugRedirects, movedProjectRedirects } from "./src/content/chapters";
import { pageSlugRedirects } from "./src/content/pages";
import { securityHeaderRules } from "./src/security-headers";

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
  // goes to that language's own slug; see src/content/pages.ts. A renamed
  // project, then a chapter's former segment (`/fr/infra`), go to their
  // current address; see src/content/chapters.ts. The first rule that matches
  // wins: moved projects come first, so an old link takes a single hop.
  async redirects() {
    return [...pageSlugRedirects(), ...movedProjectRedirects(), ...chapterSlugRedirects()];
  },
  // On every response: the security headers (src/security-headers.ts), and the
  // commit the image was built from, so the deployment can check that the site
  // really serves the new version (deploy/wait-for-version.sh).
  async headers() {
    return securityHeaderRules(process.env.ELMZN_VERSION?.trim() || undefined);
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
    // WebP only — no raw JPEG ever reaches the visitor. Each image is encoded
    // on its first request, and the cache is emptied by every deploy (it lives
    // in memory, see deploy/compose.yaml): on the homelab's server AVIF took
    // 0.52–0.71 s per cover, WebP 0.16–0.18 s, for files about twice as heavy.
    formats: ["image/webp"],
  },
};

export default nextConfig;
