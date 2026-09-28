#!/bin/sh
# Tells the homelab that a new image is published. Run by CI.
#
# The request carries no instruction — on it, the server only fetches the
# newest image from GitHub (deploy.sh) — and it is signed with a shared
# secret (HMAC-SHA256, the header GitHub itself uses), so that nobody else can
# make the server work.
#
# Usage: DEPLOY_WEBHOOK_SECRET=… notify.sh <webhook URL> <commit sha>
set -eu

url=${1:?webhook URL}
sha=${2:?commit sha}
secret=${DEPLOY_WEBHOOK_SECRET:?DEPLOY_WEBHOOK_SECRET is not set}

case $sha in
  *[!0-9a-f]* | "") echo "notify.sh: not a commit sha: $sha" >&2; exit 2 ;;
esac

body=$(printf '{"sha":"%s"}' "$sha")
signature=$(printf '%s' "$body" | openssl dgst -sha256 -hmac "$secret" -r | cut -d' ' -f1)

curl --fail --silent --show-error --max-time 30 --retry 3 --retry-all-errors \
  --request POST \
  --header "Content-Type: application/json" \
  --header "X-Hub-Signature-256: sha256=$signature" \
  --data "$body" \
  "$url"
