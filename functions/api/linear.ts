const COOKIE_SPLIT = /;\s*/;

// The proxy forwards the request body verbatim to Linear with the user's
// read/write token attached. Without this gate it is the *entire* Linear API
// (delete issues, mint API keys, exfiltrate the workspace); with it, the
// blast radius of any in-page script is exactly the six operations ggantt
// itself issues. These names must stay in sync with src/lib/queries.ts.
const ALLOWED_OPERATIONS = new Set([
  "Viewer",
  "Issues",
  "IssueSetDue",
  "IssueSetTitle",
  "Projects",
  "ProjectSetDates",
]);

const OPERATION_RE = /\b(?:query|mutation)\s+([A-Za-z_]\w*)/;

// Returns the named operation only if it is a single, allow-listed query or
// mutation. Anonymous operations, subscriptions, and unparseable bodies are
// rejected — ggantt never issues any of those.
function allowedOperation(body: string): boolean {
  let query: unknown;
  try {
    query = (JSON.parse(body) as { query?: unknown }).query;
  } catch {
    return false;
  }
  if (typeof query !== "string") {
    return false;
  }
  const name = OPERATION_RE.exec(query)?.[1];
  return name !== undefined && ALLOWED_OPERATIONS.has(name);
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

export const onRequestPost: PagesFunction = async ({ request }) => {
  // CSRF defense-in-depth: this endpoint attaches the user's read/write Linear
  // token to whatever GraphQL body it receives, so reject any cross-origin
  // caller rather than relying solely on the cookie's SameSite=Lax attribute.
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new Response("Cross-origin request rejected", { status: 403 });
  }

  const cookieHeader = request.headers.get("Cookie");
  const token = parseCookie(cookieHeader, "ggantt_token");
  if (!token) {
    console.log(
      "[api/linear] 401 — Cookie header:",
      cookieHeader ? `present (${cookieHeader.length} chars)` : "MISSING"
    );
    return new Response("Unauthenticated", { status: 401 });
  }

  const body = await request.text();
  if (!allowedOperation(body)) {
    console.error("[api/linear] rejected non-allow-listed GraphQL operation");
    return new Response("Operation not permitted", { status: 403 });
  }

  const upstream = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body,
  });

  const headers = new Headers({
    "Content-Type":
      upstream.headers.get("Content-Type") ?? "application/json; charset=utf-8",
  });

  return new Response(upstream.body, { status: upstream.status, headers });
};
