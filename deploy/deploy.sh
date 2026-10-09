#!/bin/sh
# Brings the site up to the newest published image. Run on the server every
# two minutes by a systemd timer (elmzn-deploy.timer): the server pulls,
# GitHub never pushes — no code from GitHub runs here, and nothing in GitHub
# can reach the server.
#
# With no new image: the site is only checked to be up, and nothing is printed.
# With a new one: the site restarts on it and must report healthy, must then
# serve the very commit the image was built from (its X-Elmzn-Version header),
# the previous images are dropped, and the image cache is warmed. Any failure
# stops the run and fails the unit: `systemctl status elmzn-deploy` says why.
set -eu
cd "$(dirname "$0")"

# The image compose.yaml runs (tests/unit/deploy.test.ts keeps the two equal).
image=ghcr.io/dexteee-r/portfolio:latest
site=http://127.0.0.1:3000

# One run at a time: if the previous one is still busy (a slow first start, a
# cache being warmed), this one simply steps aside — the next tick comes soon.
exec 9<"$0"
flock -n 9 || exit 0

image_id() { docker image inspect --format '{{.Id}}' "$image" 2>/dev/null || true; }

before=$(image_id)
docker compose pull --quiet web
after=$(image_id)
# Starts the site if it stopped, recreates it only if the image changed, and
# waits until it reports healthy (the image's HEALTHCHECK) — or fails loudly.
docker compose up --detach --wait --wait-timeout 120 web
[ "$before" = "$after" ] && exit 0

version=$(docker image inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$image" | sed -n 's/^ELMZN_VERSION=//p')
sh ./wait-for-version.sh "$site/fr" "${version:?the image does not say which commit it is}" "${VERSION_TIMEOUT:-120}"
# The previous image is now unused: drop it, and only images of this site.
docker image prune --force --filter "label=org.opencontainers.image.source=https://github.com/dexteee-r/Portfolio" >/dev/null
# Never fails the deployment (the script always exits 0).
if [ -f ./warm-cache.sh ]; then sh ./warm-cache.sh "$site"; fi
echo "elmzn: deployed $version"
