#!/bin/sh
# Warms the image-optimisation cache once the new version serves. The cache
# lives in memory (compose.yaml) and every deploy empties it: without this,
# each image would be encoded on its first visitor's request. Run on the
# server by the homelab's runner, after wait-for-version.sh (deploy.yml).
#
# Asks the site for every image every page of its sitemap shows, at every
# width its srcset offers — once each, one at a time, so the site keeps
# answering its visitors meanwhile. Never fails a deployment: a page or an
# image that does not answer is counted, then skipped.
#
# Usage: warm-cache.sh [site URL]   (default: http://127.0.0.1:3000)
set -u

site=${1:-http://127.0.0.1:3000}
start=$(date +%s)

sitemap=$(curl --silent --fail --max-time 30 "$site/sitemap.xml") || {
  echo "elmzn: sitemap unreachable at $site, image cache not warmed"
  exit 0
}
# Each page's path: the sitemap names them on the public origin, asked here locally.
pages=$(printf '%s\n' "$sitemap" | grep -o '<loc>[^<]*</loc>' | sed -e 's#<loc>[a-z]*://[^/]*##' -e 's#</loc>##')

# The images of every page, as their srcset spells them. The same URLs also
# appear escaped in the page's React payload (&, \"): those are left out.
images=$(
  for page in $pages; do
    curl --silent --fail --max-time 30 "$site$page"
  done | grep -o '/_next/image?url=[^" ,]*' | grep -vF '\' | sed 's/&amp;/\&/g' | sort -u
)

warmed=0
failed=0
for image in $images; do
  if curl --silent --fail --max-time 60 --output /dev/null --header "Accept: image/avif,image/webp,*/*" "$site$image"; then
    warmed=$((warmed + 1))
  else
    failed=$((failed + 1))
  fi
done

pages_count=$(printf '%s\n' "$pages" | grep -c .)
echo "elmzn: image cache warmed — $warmed ok, $failed failed, from $pages_count pages, in $(( $(date +%s) - start ))s"
exit 0
