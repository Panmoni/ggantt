interface Env {
  // Comma-separated list of Linear account emails permitted to use this
  // deployment. If unset/empty, NO ONE can sign in (fail closed).
  ALLOWED_EMAILS?: string;
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

interface ViewerResponse {
  data?: { viewer?: { email?: string } };
}

// Returns true only when allowlist is configured AND the email is on it.
// An unconfigured allowlist denies everyone (fail closed) so that forgetting
// to set ALLOWED_EMAILS can never silently open the app to the world.
function isAllowed(allowList: string | undefined, email: string): boolean {
  if (!allowList) {
    return false;
  }
  const normalized = email.trim().toLowerCase();
  return allowList
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}

// Ask Linear who the freshly issued token belongs to.
async function fetchViewerEmail(token: string): Promise<string | undefined> {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query: "{ viewer { email } }" }),
  });
  if (!res.ok) {
    return;
  }
  const json = (await res.json()) as ViewerResponse;
  return json.data?.viewer?.email;
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

  // A 200 response without a usable access_token (Linear error-with-200,
  // schema drift) must fail loudly as a token error here, rather than fall
  // through to the viewer lookup and surface as a misleading 403.
  if (typeof token.access_token !== "string" || token.access_token === "") {
    console.error("[oauth/callback] token response had no access_token");
    return new Response("Token exchange failed", { status: 502 });
  }

  // Single-user gate: this deployment is private. Only Linear accounts whose
  // email is on ALLOWED_EMAILS may establish a session. We discard the token
  // (never set the cookie) for anyone else, so a stranger's OAuth grant is
  // useless against this app.
  const email = await fetchViewerEmail(token.access_token);
  if (!(email && isAllowed(env.ALLOWED_EMAILS, email))) {
    console.error(
      `[oauth/callback] rejected sign-in for ${email ?? "unknown viewer"}`
    );
    return new Response("Not authorized for this deployment", { status: 403 });
  }

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
