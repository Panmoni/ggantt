import { parseCookie, serializeCookie } from "../_lib/cookies.ts";
import { decryptToken } from "../_lib/crypto.ts";
import { log } from "../_lib/log.ts";
import { fetchUpstream } from "../_lib/upstream.ts";

interface Env {
  COOKIE_SECRET?: string;
}

// GET so a plain <a href> works. Forced-logout CSRF is an annoyance only
// (no state change beyond ending the attacker's victim's own session) and
// not worth a token round-trip here.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const secure = new URL(request.url).protocol === "https:";
  const sealed = parseCookie(request.headers.get("Cookie"), "ggantt_token");

  // Best-effort: tell Linear to revoke the token so a copy that leaked
  // before logout stops working too. Never block logout on it.
  if (sealed && env.COOKIE_SECRET) {
    const token = await decryptToken(sealed, env.COOKIE_SECRET);
    if (token) {
      const res = await fetchUpstream("https://api.linear.app/oauth/revoke", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res === "timeout" || !res.ok) {
        log("warn", "logout.revoke.failed", {
          status: res === "timeout" ? "timeout" : res.status,
        });
      }
    }
  }

  const headers = new Headers({ Location: "/" });
  headers.append(
    "Set-Cookie",
    serializeCookie("ggantt_token", "", {
      maxAge: 0,
      sameSite: "Strict",
      secure,
    })
  );
  return new Response(null, { status: 302, headers });
};
