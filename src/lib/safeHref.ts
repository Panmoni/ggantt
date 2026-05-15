// Linear-supplied URLs are always https://linear.app/..., but React does not
// neutralize a `javascript:`/`data:` href, so allow only http(s) before
// handing an API-provided URL to an <a href>. Returns undefined for anything
// else, which makes the anchor inert.
export function safeHref(url: string | null | undefined): string | undefined {
  if (!url) {
    return;
  }
  try {
    const { protocol } = new URL(url);
    if (protocol === "https:" || protocol === "http:") {
      return url;
    }
  } catch {
    // Not an absolute parseable URL — treat as unsafe.
  }
  return;
}
