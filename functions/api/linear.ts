import { parseCookie } from "../_lib/cookies.ts";
import { decryptToken } from "../_lib/crypto.ts";
import { allowedOperation } from "../_lib/graphql.ts";
import { log } from "../_lib/log.ts";
import { fetchUpstream } from "../_lib/upstream.ts";

interface Env {
  COOKIE_SECRET?: string;
}

async function handleProxy(request: Request, env: Env): Promise<Response> {
  if (!env.COOKIE_SECRET) {
    log("error", "config.missing", { var: "COOKIE_SECRET" });
    return new Response("Server misconfigured", { status: 500 });
  }

  // CSRF defense-in-depth: this endpoint attaches the user's read/write Linear
  // token to whatever GraphQL body it receives. The SameSite=Strict cookie
  // already blocks cross-site sends; additionally require the Origin header to
  // be present AND match — a state-changing POST from the SPA always sends it.
  if (request.headers.get("Origin") !== new URL(request.url).origin) {
    return new Response("Cross-origin request rejected", { status: 403 });
  }

  const sealed = parseCookie(request.headers.get("Cookie"), "ggantt_token");
  const token = sealed
    ? await decryptToken(sealed, env.COOKIE_SECRET)
    : undefined;
  if (!token) {
    return new Response("Unauthenticated", { status: 401 });
  }

  const body = await request.text();
  if (!allowedOperation(body)) {
    log("warn", "proxy.operation.rejected");
    return new Response("Operation not permitted", { status: 403 });
  }

  const upstream = await fetchUpstream("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body,
  });
  if (upstream === "timeout") {
    log("error", "proxy.upstream.timeout");
    return new Response("Upstream timed out", { status: 504 });
  }

  const headers = new Headers({
    "Content-Type":
      upstream.headers.get("Content-Type") ?? "application/json; charset=utf-8",
  });
  return new Response(upstream.body, { status: upstream.status, headers });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    return await handleProxy(request, env);
  } catch (err) {
    log("error", "proxy.unhandled", {
      error: err instanceof Error ? err.message : String(err),
    });
    return new Response("Proxy error", { status: 502 });
  }
};
