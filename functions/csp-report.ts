import { log } from "./_lib/log.ts";

// CSP violation sink referenced by the report-to/report-uri directive in
// public/_headers. Browsers POST a JSON report here; we log it (Logpush-
// friendly) and return 204. A flood of these is the early signal that an
// injection got past React escaping / safeHref.
export const onRequestPost: PagesFunction = async ({ request }) => {
  const body = await request.text();
  log("warn", "csp.violation", { report: body.slice(0, 2000) });
  return new Response(null, { status: 204 });
};
