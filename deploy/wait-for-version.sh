#!/bin/sh
# Waits until the site really serves the expected version — the commit sent
# back in its X-Elmzn-Version header — so a deployment that silently failed
# turns the Deploy workflow red instead of going unnoticed. Run on the server
# by the homelab's runner (deploy.yml).
#
# Usage: wait-for-version.sh <page URL> <commit sha> [timeout in seconds]
set -eu

url=${1:?page URL}
expected=${2:?commit sha}
timeout=${3:-300}
interval=${POLL_SECONDS:-10}
deadline=$(( $(date +%s) + timeout ))

while :; do
  served=$(curl --silent --max-time 10 --head "$url" 2>/dev/null \
    | tr -d '\r' \
    | awk -F': *' 'tolower($1) == "x-elmzn-version" { print $2 }' || true)
  if [ "$served" = "$expected" ]; then
    echo "Live: $url serves $expected"
    exit 0
  fi
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "Still serving '${served:-no version}' instead of $expected after ${timeout}s: $url" >&2
    exit 1
  fi
  sleep "$interval"
done
