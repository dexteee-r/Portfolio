# syntax=docker/dockerfile:1
#
# The site as a self-contained Node server (Next.js standalone output), run on
# the homelab. CI builds it only after every check has passed, smoke-tests it
# (deploy/smoke-test.sh), then publishes it to ghcr.io; see
# .github/workflows/ci.yml. Secrets are never baked in: the CMS settings come
# from the server's .env at run time (deploy/compose.yaml).

# Same major version as CI (actions/setup-node); a unit test keeps them equal.
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The commit this image is built from, sent on every response (X-Elmzn-Version).
ARG ELMZN_VERSION=""
ENV ELMZN_VERSION=${ELMZN_VERSION}
RUN npm run build

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
LABEL org.opencontainers.image.source="https://github.com/dexteee-r/Portfolio" \
      org.opencontainers.image.description="ELMZN — portfolio, elmzn.be"
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# The app's files belong to root: the server, running as `node`, can read them
# but never change them. Only the image-optimisation cache is its to write.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
RUN mkdir -p .next/cache && chown node:node .next/cache
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/fr').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server.js"]
