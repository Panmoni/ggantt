// Files/dirs under functions/ whose name starts with "_" are NOT routed by
// Cloudflare Pages — this is shared helper code, imported by the route
// modules and bundled normally. parseCookie used to be copy-pasted into both
// callback.ts and api/linear.ts; it lives here once now.

const COOKIE_SPLIT = /;\s*/;

export function parseCookie(
  header: string | null,
  name: string
): string | undefined {
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

export interface CookieOptions {
  maxAge: number;
  sameSite: "Strict" | "Lax";
  secure: boolean;
}

// Single source of truth for cookie attributes so HttpOnly/Secure/SameSite
// can never drift between the set, clear, and re-set paths.
export function serializeCookie(
  name: string,
  value: string,
  opts: CookieOptions
): string {
  const secure = opts.secure ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; HttpOnly${secure}; SameSite=${opts.sameSite}; Path=/; Max-Age=${opts.maxAge}`;
}
