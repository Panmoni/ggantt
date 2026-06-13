// Shared predicate for Linear workflow/project statuses. Both an issue's `state`
// and a project's `status` expose the same `{ name, type }` shape, so the same
// rule decides whether a record is "resolved" and should be hidden by default.
//
// Linear's status `type` is one of: backlog, planned, started, paused, unstarted,
// completed, canceled. We treat `completed` (Done) and `canceled` as resolved.
// "Duplicate" is, in the default Linear workflow, a `canceled`-type status, so it
// is already covered by the type check; we also match on name as a safety net for
// workspaces that put a custom "Duplicate" status under a different type.
const HIDDEN_TYPES = new Set(["completed", "canceled"]);
const HIDDEN_NAMES = new Set([
  "done",
  "completed",
  "cancelled",
  "canceled",
  "duplicate",
]);

export function isDoneCancelledOrDuplicate(s: {
  name: string;
  type: string;
}): boolean {
  return (
    HIDDEN_TYPES.has(s.type) || HIDDEN_NAMES.has(s.name.trim().toLowerCase())
  );
}
