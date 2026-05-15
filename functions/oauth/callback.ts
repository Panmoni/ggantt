interface Env {
  LINEAR_CLIENT_ID: string;
  LINEAR_CLIENT_SECRET: string;
  OAUTH_REDIRECT_URI: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

const COOKIE_SPLIT = /;\s*/;

// Length-independent, constant-time string comparison for the OAuth state.
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length === bb.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    diff += (ab[i] ?? 0) === (bb[i] ?? 0) ? 0 : 1;
  }
  return diff === 0;
}

function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) {
    return;
  }
  for (const part of header.split(COOKIE_SPLIT)) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq) === name) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = parseCookie(
    request.headers.get("Cookie"),
    "ggantt_oauth_state"
  );

  if (!(code && state && cookieState)) {
    return new Response("OAuth state mismatch", { status: 400 });
  }
  if (!timingSafeEqual(state, cookieState)) {
    return new Response("OAuth state mismatch", { status: 400 });
  }

  const tokenRes = await fetch("https://api.linear.app/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.LINEAR_CLIENT_ID,
      client_secret: env.LINEAR_CLIENT_SECRET,
      redirect_uri: env.OAUTH_REDIRECT_URI,
      grant_type: "authorization_code",
      code,
    }).toString(),
  });

  if (!tokenRes.ok) {
    // Log status only — the upstream body can echo request/credential
    // context and ends up in Cloudflare logs.
    console.error(`[oauth/callback] token exchange failed: ${tokenRes.status}`);
    return new Response("Token exchange failed", { status: 502 });
  }

  const token = (await tokenRes.json()) as TokenResponse;

  const isHttps = url.protocol === "https:";
  const secure = isHttps ? "; Secure" : "";

  // Match the cookie lifetime to the token's. Linear's default tokens are
  // long-lived; fall back to 30 days if expires_in is absent or unreasonable.
  const THIRTY_DAYS = 2_592_000;
  const maxAge =
    Number.isFinite(token.expires_in) && token.expires_in > 0
      ? token.expires_in
      : THIRTY_DAYS;

  const headers = new Headers({ Location: "/" });
  headers.append(
    "Set-Cookie",
    `ggantt_token=${encodeURIComponent(token.access_token)}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${maxAge}`
  );
  headers.append(
    "Set-Cookie",
    `ggantt_oauth_state=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`
  );

  return new Response(null, { status: 302, headers });
};
