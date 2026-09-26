import type { NextRequest } from "next/server";
import { ADMIN_HEADERS, adminPage, notConfiguredPage } from "@/cms/admin-page";
import { cmsConfig } from "@/cms/config";
import { repoSettings } from "@/cms/oauth";

export const dynamic = "force-dynamic";

/** The editing panel. Its OAuth endpoints are this very site, wherever it is served from. */
export function GET(request: NextRequest) {
  const repo = repoSettings();
  if (!repo) return new Response(notConfiguredPage(), { status: 503, headers: ADMIN_HEADERS });
  const config = cmsConfig({ ...repo, baseUrl: request.nextUrl.origin });
  return new Response(adminPage(config), { headers: ADMIN_HEADERS });
}
