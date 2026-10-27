/**
 * Google sign-in (OAuth 2.0 authorisation code flow).
 *
 * Nothing here runs until `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set,
 * because the client is registered in your own Google Cloud project and the
 * redirect URI must be a public HTTPS address. Until then the sign-in screen
 * shows "Continue with Google — awaiting configuration" and the routes answer
 * with the real reason instead of a broken redirect.
 *
 * Flow:
 *   1. `/api/auth/google/start` → redirect to Google with a `state` nonce stored
 *      in an HttpOnly cookie.
 *   2. `/api/auth/google/callback` → verify `state`, exchange the code at
 *      Google's token endpoint, read the verified profile, create/link the
 *      account, then redirect into the studio.
 */

/** Cookie holding the OAuth `state` nonce between /start and /callback. */
export const OAUTH_STATE_COOKIE = "eldermi_oauth_state";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

/** Why Google sign-in is unavailable, in one sentence. */
export function googleStatus(): { configured: boolean; reason: string } {
  if (!process.env.GOOGLE_CLIENT_ID?.trim()) {
    return {
      configured: false,
      reason: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google sign-in.",
    };
  }
  if (!process.env.GOOGLE_CLIENT_SECRET?.trim()) {
    return { configured: false, reason: "GOOGLE_CLIENT_SECRET is missing." };
  }
  return { configured: true, reason: "Google sign-in is configured." };
}

/** The callback URL Google must be told about. Must match the Cloud console. */
export function redirectUri(origin: string): string {
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (configured) return configured;
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || origin;
  return `${base}/api/auth/google/callback`;
}

/** Build the consent-screen URL. */
export function authorizationUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name?: string;
  emailVerified: boolean;
}

/** Exchange an authorisation code for tokens and read the profile. */
export async function exchangeCodeForProfile(
  code: string,
  origin: string,
): Promise<GoogleProfile> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "",
    redirect_uri: redirectUri(origin),
    grant_type: "authorization_code",
  });

  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenResponse.ok) {
    const detail = (await tokenResponse.text().catch(() => "")).slice(0, 300);
    throw new Error(`Google refused the sign-in (${tokenResponse.status}): ${detail}`);
  }
  const tokens = (await tokenResponse.json()) as { access_token?: string };
  if (!tokens.access_token) throw new Error("Google returned no access token.");

  const profileResponse = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileResponse.ok) {
    throw new Error("Google did not return the account profile.");
  }
  const profile = (await profileResponse.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    email_verified?: boolean;
  };
  if (!profile.sub || !profile.email) {
    throw new Error("Google returned a profile without an email address.");
  }
  return {
    sub: profile.sub,
    email: profile.email,
    name: profile.name,
    emailVerified: profile.email_verified === true,
  };
}
