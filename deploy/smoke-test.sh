#!/bin/sh
# Runs an image exactly as the homelab does (read-only, no capabilities,
# behind a proxy that speaks HTTPS) and checks that it serves the site. CI
# runs it before publishing an image; it works locally too, with Docker.
#
# Usage: smoke-test.sh <image> <expected version>
set -eu
# Git Bash on Windows would rewrite /app/… into a Windows path: not here.
export MSYS_NO_PATHCONV=1

image=${1:?image}
version=${2:?expected version}
name=elmzn-smoke-$$
port=${SMOKE_PORT:-3999}
base=http://127.0.0.1:$port
failures=0

docker run --detach --name "$name" \
  --read-only --tmpfs /app/.next/cache:uid=1000,gid=1000 --tmpfs /tmp \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --publish "127.0.0.1:$port:3000" \
  --env CMS_GITHUB_REPO=example/elmzn \
  --env CMS_GITHUB_CLIENT_ID=smoke-client-id \
  --env CMS_GITHUB_CLIENT_SECRET=smoke-client-secret \
  "$image" >/dev/null
trap 'docker logs "$name" >smoke-server.log 2>&1 || true; docker rm --force "$name" >/dev/null 2>&1 || true' EXIT

pass() { echo "  ok    $1"; }
fail() { echo "  FAIL  $1" >&2; failures=$((failures + 1)); }
check() { if eval "$2"; then pass "$1"; else fail "$1"; fi; }
status() { curl --silent --output /dev/null --write-out '%{http_code}' "$@"; }
headers() { curl --silent --output /dev/null --dump-header - "$@" | tr -d '\r'; }
header() { headers "$2" | awk -F': *' -v h="$1" 'tolower($1) == h { print $2 }'; }

echo "Waiting for $image to report healthy…"
for _ in $(seq 60); do
  health=$(docker inspect --format '{{.State.Health.Status}}' "$name")
  [ "$health" = healthy ] && break
  sleep 2
done
check "the container reports healthy" '[ "$health" = healthy ]'
check "it runs as an unprivileged user" '[ "$(docker exec "$name" id -u)" != 0 ]'

echo "Pages"
check "/fr answers 200" '[ "$(status "$base/fr")" = 200 ]'
check "/fr says which version it is ($version)" '[ "$(header x-elmzn-version "$base/fr")" = "$version" ]'
check "/ redirects to /fr" 'header location "$base/" | grep -q "/fr$"'
check "/en/legal-notice answers 200" '[ "$(status "$base/en/legal-notice")" = 200 ]'
check "/en/mentions-legales redirects to /en/legal-notice" \
  'header location "$base/en/mentions-legales" | grep -q "/en/legal-notice$"'
check "an unknown page is a real 404, fully rendered" \
  '[ "$(status "$base/fr/nope")" = 404 ] && curl --silent "$base/fr/nope" | grep -q "Ce dossier n"'

echo "Files"
asset=$(curl --silent "$base/fr" | grep -o '/_next/static/[^"]*\.js' | head -n 1)
check "the page's scripts are served ($asset)" '[ -n "$asset" ] && [ "$(status "$base$asset")" = 200 ]'
check "images are optimised (sharp is in the image)" \
  'headers "$base/_next/image?url=%2Ficon%2F192&w=64&q=75" | grep -qi "^content-type: image/"'
check "robots.txt points at the sitemap" 'curl --silent "$base/robots.txt" | grep -q "Sitemap: https://elmzn.be/sitemap.xml"'
check "the sitemap answers 200" '[ "$(status "$base/sitemap.xml")" = 200 ]'

echo "CMS"
check "/admin serves the panel" 'curl --silent "$base/admin" | grep -q "CMS.init"'
check "Sveltia's bundle is served" '[ "$(status "$base/admin/sveltia-cms.js")" = 200 ]'
signin=$(headers --header "Host: elmzn.be" --header "X-Forwarded-Proto: https" "$base/api/cms/auth?provider=github")
check "behind the proxy, sign-in sends GitHub back to https://elmzn.be" \
  'printf "%s" "$signin" | grep -qi "^location: https://github.com/login/oauth/authorize?.*redirect_uri=https%3A%2F%2Felmzn.be%2Fapi%2Fcms%2Fcallback"'
check "behind the proxy, the state cookie is Secure" \
  'printf "%s" "$signin" | grep -i "^set-cookie: elmzn_cms_state=" | grep -qi "secure"'

echo "Server"
check "optimised images are cached (a second request is a cache hit)" \
  'headers "$base/_next/image?url=%2Ficon%2F192&w=64&q=75" | grep -qi "^x-nextjs-cache: HIT"'
check "no write refused, no unhandled error in the server's log" \
  '! docker logs "$name" 2>&1 | grep -qiE "EACCES|EROFS|read-only file system|unhandledRejection|Failed to write"'

if [ "$failures" -gt 0 ]; then
  echo "$failures check(s) failed — server log in smoke-server.log" >&2
  exit 1
fi
echo "All checks passed."
