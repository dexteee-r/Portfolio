import type { NextConfig } from "next";

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
