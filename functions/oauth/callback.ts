import { isAllowed } from "../_lib/allowlist.ts";
import { parseCookie, serializeCookie } from "../_lib/cookies.ts";
import { encryptToken } from "../_lib/crypto.ts";
import { log } from "../_lib/log.ts";
import { timingSafeEqual } from "../_lib/oauthState.ts";
import { fetchUpstream } from "../_lib/upstream.ts";

interface Env {
  // Comma-separated list of Linear account emails permitted to use this
  // deployment. If unset/empty, NO ONE can sign in (fail closed).
  ALLOWED_EMAILS?: string;
  // Secret used to encrypt the token cookie. Required; missing => 500.
  COOKIE_SECRET?: string;
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

// "ok" carries Linear's definitive answer (an email, or undefined when the
// token genuinely maps to no/again-no allow-listed identity). "upstream-error"
// means we never got a definitive answer (timeout, 5xx, 429) and must NOT be
// conflated with "not authorized" — otherwise a Linear outage tells a valid
// user they're banned and the security log can't tell them from a stranger.
type ViewerLookup =
  | { email: string | undefined; kind: "ok" }
  | { kind: "upstream-error" };

async function fetchViewerEmail(token: string): Promise<ViewerLookup> {
  const res = await fetchUpstream("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query: "{ viewer { email } }" }),
  });
  if (res === "timeout") {
    return { kind: "upstream-error" };
  }
  if (!res.ok) {
    return res.status >= 500 || res.status === 429
      ? { kind: "upstream-error" }
      : { email: undefined, kind: "ok" };
  }
  const json = (await res.json()) as ViewerResponse;
  return { email: json.data?.viewer?.email, kind: "ok" };
}

// Token cookie lifetime is capped well below Linear's (long-lived) token so
// a leaked cookie has a bounded blast window and the user re-auths weekly.
const SEVEN_DAYS = 604_800;

async function handleCallback(request: Request, env: Env): Promise<Response> {
  if (!env.COOKIE_SECRET) {
    log("error", "config.missing", { var: "COOKIE_SECRET" });
    return new Response("Server misconfigured", { status: 500 });
  }

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

  const tokenRes = await fetchUpstream("https://api.linear.app/oauth/token", {
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

  if (tokenRes === "timeout") {
    log("error", "oauth.token.timeout");
    return new Response("Token exchange timed out", { status: 504 });
  }
  if (!tokenRes.ok) {
    // Log status only — the upstream body can echo request/credential
    // context and ends up in Cloudflare logs.
    log("error", "oauth.token.failed", { status: tokenRes.status });
    return new Response("Token exchange failed", { status: 502 });
  }

  const token = (await tokenRes.json()) as TokenResponse;

  // A 200 response without a usable access_token (Linear error-with-200,
  // schema drift) must fail loudly as a token error here, rather than fall
  // through to the viewer lookup and surface as a misleading 403.
  if (typeof token.access_token !== "string" || token.access_token === "") {
    log("error", "oauth.token.no_access_token");
    return new Response("Token exchange failed", { status: 502 });
  }

  // Single-user gate: this deployment is private. Only Linear accounts whose
  // email is on ALLOWED_EMAILS may establish a session. We discard the token
  // (never set the cookie) for anyone else, so a stranger's OAuth grant is
  // useless against this app.
  const lookup = await fetchViewerEmail(token.access_token);
  if (lookup.kind === "upstream-error") {
    log("error", "oauth.viewer.upstream_error");
    return new Response("Linear is unavailable — please try again", {
      status: 503,
    });
  }
  const email = lookup.email;
  if (!(email && isAllowed(env.ALLOWED_EMAILS, email))) {
    log("warn", "oauth.signin.rejected", { email: email ?? "unknown" });
    return new Response("Not authorized for this deployment", { status: 403 });
  }

  const secure = url.protocol === "https:";
  const maxAge =
    Number.isFinite(token.expires_in) && token.expires_in > 0
      ? Math.min(token.expires_in, SEVEN_DAYS)
      : SEVEN_DAYS;

  const sealed = await encryptToken(token.access_token, env.COOKIE_SECRET);

  const headers = new Headers({ Location: "/" });
  // Token cookie has no cross-site flow, so it can be the stricter SameSite.
  headers.append(
    "Set-Cookie",
    serializeCookie("ggantt_token", sealed, {
      maxAge,
      sameSite: "Strict",
      secure,
    })
  );
  // The state cookie must stay Lax (it had to survive the cross-site
  // redirect back from linear.app); clear it now.
  headers.append(
    "Set-Cookie",
    serializeCookie("ggantt_oauth_state", "", {
      maxAge: 0,
      sameSite: "Lax",
      secure,
    })
  );

  log("info", "oauth.signin.ok", { email });
  return new Response(null, { status: 302, headers });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    return await handleCallback(request, env);
  } catch (err) {
    // Non-abort network failure, 200-non-JSON from Linear, etc. Without this
    // it would surface as Cloudflare's generic 500 with no log line.
    log("error", "oauth.callback.unhandled", {
      error: err instanceof Error ? err.message : String(err),
    });
    return new Response("OAuth flow failed", { status: 502 });
  }
};
