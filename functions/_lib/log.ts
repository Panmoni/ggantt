// One-line JSON logs. Cloudflare Pages Functions stdout is line-delimited;
// emitting structured JSON makes `wrangler pages deployment tail` and
// Cloudflare Logpush filterable (by `event`, `level`, …) instead of
// scraping free-text. No external dependency or DSN required.

type Level = "info" | "warn" | "error";

export function log(
  level: Level,
  event: string,
  fields?: Record<string, unknown>
): void {
  const line = JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}
