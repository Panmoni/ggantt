function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) {
    return;
  }
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq) === name) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return;
}

export const onRequestPost: PagesFunction = async ({ request }) => {
  const cookieHeader = request.headers.get("Cookie");
  const token = parseCookie(cookieHeader, "ggantt_token");
  if (!token) {
    console.log(
      "[api/linear] 401 — Cookie header:",
      cookieHeader ? `present (${cookieHeader.length} chars)` : "MISSING"
    );
    return new Response("Unauthenticated", { status: 401 });
  }

  const upstream = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: await request.text(),
  });

  const headers = new Headers({
    "Content-Type":
      upstream.headers.get("Content-Type") ?? "application/json; charset=utf-8",
  });

  return new Response(upstream.body, { status: upstream.status, headers });
};
