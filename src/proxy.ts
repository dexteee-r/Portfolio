import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale } from "@/i18n/config";
import { LOCALE_HEADER, localeFromPathname, localeRedirectPath } from "@/i18n/routing";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const target = localeRedirectPath(pathname);

  if (target === null) {
    const headers = new Headers(request.headers);
    headers.set(LOCALE_HEADER, localeFromPathname(pathname) ?? defaultLocale);
    return NextResponse.next({ request: { headers } });
  }

  const url = request.nextUrl.clone();
  url.pathname = target;
  // 307: the root redirect must stay revisable if the default locale changes.
  return NextResponse.redirect(url, 307);
}

export const config = {
  matcher: [
    // Everything except framework internals, the CMS panel, API routes, the
    // generated icons (/icon/32, /apple-icon: no dot in their URLs) and any
    // request for a file (robots.txt, sitemap.xml, images…).
    // tests/unit/proxy-matcher.test.ts pins exactly which paths this covers.
    "/((?!_next/|api/|admin(?:/|$)|icon(?:/|$)|apple-icon(?:/|$)|.*\\..*).*)",
  ],
};
