#!/bin/sh
# Brings the site up to the newest published image. Run by the homelab's
# GitHub Actions runner after every successful CI run on main (deploy.yml),
# and hourly by the safety-net timer. Idempotent: with no new image, nothing
# restarts.
set -eu
cd "$(dirname "$0")"

# One deployment at a time: a second call waits for the first to finish. The
# lock is this very script, opened for reading: the runner's user and the
# timer's root can both take it, whoever came first.
exec 9<"$0"
flock 9

docker compose pull --quiet web
# Recreates the container only if the image changed, then waits until the
# new one reports healthy (the image's HEALTHCHECK) — or fails loudly.
docker compose up --detach --wait --wait-timeout 120 web
# The previous image is now unused: drop it, and only images of this site.
docker image prune --force --filter "label=org.opencontainers.image.source=https://github.com/dexteee-r/Portfolio" >/dev/null
echo "elmzn: up to date"
