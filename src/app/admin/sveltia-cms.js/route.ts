import { readFileSync } from "node:fs";
import { sveltiaBundlePath } from "@/cms/admin-page";

export const dynamic = "force-static";

/** The pinned Sveltia CMS bundle, from node_modules. Versioned by the query string. */
export function GET() {
  return new Response(readFileSync(sveltiaBundlePath()), {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Robots-Tag": "noindex",
    },
  });
}
