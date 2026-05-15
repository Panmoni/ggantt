// Wraps an outbound fetch with a hard timeout. A hung Linear API must not
// hold a Worker open until Cloudflare force-kills it — bound it and let the
// caller return a clean 504.

export const UPSTREAM_TIMEOUT_MS = 10_000;

export async function fetchUpstream(
  input: string,
  init: RequestInit,
  ms: number = UPSTREAM_TIMEOUT_MS
): Promise<Response | "timeout"> {
  try {
    return await fetch(input, { ...init, signal: AbortSignal.timeout(ms) });
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === "TimeoutError" || err.name === "AbortError")
    ) {
      return "timeout";
    }
    throw err;
  }
}
