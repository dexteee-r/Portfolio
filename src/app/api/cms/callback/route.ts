import type { NextRequest } from "next/server";
import {
  CALLBACK_PATH,
  callbackResponse,
  exchangeCode,
  oauthSettings,
  SIGN_IN_ERRORS,
  STATE_COOKIE,
  statesMatch,
} from "@/cms/oauth";
import { publicOrigin } from "@/lib/public-origin";

export const dynamic = "force-dynamic";

/** Step 2 of the CMS sign-in: check the state, trade the code for a token, hand it to the CMS. */
export async function GET(request: NextRequest) {
  // The panel's origin, where the token is handed over (behind the proxy, not the server's own address).
  const origin = publicOrigin(request);
  const settings = oauthSettings();
  if (!settings) {
    return callbackResponse(origin, { error: "CMS sign-in is not configured.", errorCode: SIGN_IN_ERRORS.notConfigured }, 503);
  }

  const params = request.nextUrl.searchParams;
  const denied = params.get("error");
  if (denied) {
    return callbackResponse(
      origin,
      { error: params.get("error_description") ?? "Sign-in was cancelled.", errorCode: denied },
      400,
    );
  }

  const code = params.get("code");
  const state = params.get("state");
  const expected = request.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !expected || !statesMatch(state, expected)) {
    return callbackResponse(
      origin,
      { error: "The sign-in could not be verified. Please try again.", errorCode: SIGN_IN_ERRORS.forgedCallback },
      400,
    );
  }

  const result = await exchangeCode({
    clientId: settings.clientId,
    clientSecret: settings.clientSecret,
    code,
    redirectUri: new URL(CALLBACK_PATH, origin).toString(),
  });
  return callbackResponse(origin, result, "token" in result ? 200 : 502);
}
