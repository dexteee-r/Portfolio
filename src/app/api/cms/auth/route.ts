import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_HEADERS,
  authorizeUrl,
  CALLBACK_PATH,
  callbackResponse,
  createState,
  oauthSettings,
  SIGN_IN_ERRORS,
  STATE_COOKIE,
  STATE_MAX_AGE_SECONDS,
} from "@/cms/oauth";
import { publicOrigin } from "@/lib/public-origin";

export const dynamic = "force-dynamic";

/** Step 1 of the CMS sign-in: off to GitHub, with a state cookie to check on the way back. */
export function GET(request: NextRequest) {
  // The visitor's own origin, not the server's listening address (behind the proxy).
  const origin = publicOrigin(request);
  const settings = oauthSettings();
  if (!settings) {
    return callbackResponse(
      origin,
      {
        error: "CMS sign-in is not configured (CMS_GITHUB_CLIENT_ID, CMS_GITHUB_CLIENT_SECRET).",
        errorCode: SIGN_IN_ERRORS.notConfigured,
      },
      503,
    );
  }

  const provider = request.nextUrl.searchParams.get("provider");
  if (provider !== null && provider !== "github") {
    return callbackResponse(
      origin,
      { error: "Only GitHub sign-in is supported.", errorCode: SIGN_IN_ERRORS.unsupportedProvider },
      400,
    );
  }

  const state = createState();
  const redirectUri = new URL(CALLBACK_PATH, origin).toString();
  const response = NextResponse.redirect(
    authorizeUrl({ clientId: settings.clientId, scope: settings.scope, state, redirectUri }),
    302,
  );
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: origin.startsWith("https:"),
    sameSite: "lax",
    path: "/api/cms",
    maxAge: STATE_MAX_AGE_SECONDS,
  });
  for (const [name, value] of Object.entries(AUTH_HEADERS)) response.headers.set(name, value);
  return response;
}
