// The proxy forwards the request body verbatim to Linear with the user's
// read/write token attached. Without this gate it is the *entire* Linear API
// (delete issues, mint API keys, exfiltrate the workspace); with it, the
// blast radius of any in-page script is exactly the six operations ggantt
// itself issues. These names must stay in sync with src/lib/queries.ts.
export const ALLOWED_OPERATIONS: ReadonlySet<string> = new Set([
  "Viewer",
  "Issues",
  "IssueSetDue",
  "IssueSetTitle",
  "Projects",
  "ProjectSetDates",
]);

// Every operation-definition keyword in the document. A GraphQL request may
// legally carry several operations and pick one via `operationName`; matching
// only the first keyword would let `query Issues{…} mutation Evil{…}` +
// operationName:"Evil" sail through. ggantt only ever sends ONE named op, so
// we require exactly that.
const OP_DEF_RE = /\b(?:query|mutation|subscription)\b/g;
const OP_NAME_RE = /\b(?:query|mutation)\s+([A-Za-z_]\w*)/;

// Returns true only for a single, allow-listed named query or mutation.
// Rejected: multiple/batched operations, anonymous operations, subscriptions,
// an `operationName` that points at something other than the matched op, and
// unparseable bodies — ggantt never issues any of those.
export function allowedOperation(body: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return false;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return false;
  }
  const record = parsed as { operationName?: unknown; query?: unknown };

  const query = record.query;
  if (typeof query !== "string") {
    return false;
  }

  // Exactly one operation definition, and it must not be a subscription.
  const keywords = query.match(OP_DEF_RE);
  if (
    keywords === null ||
    keywords.length !== 1 ||
    keywords[0] === "subscription"
  ) {
    return false;
  }

  const name = OP_NAME_RE.exec(query)?.[1];
  if (name === undefined || !ALLOWED_OPERATIONS.has(name)) {
    return false;
  }

  // If the client pinned an operationName it must be the one op we matched.
  const opName = record.operationName;
  if (typeof opName === "string" && opName !== name) {
    return false;
  }
  return true;
}
