import { differenceInCalendarDays } from "date-fns";
import { issueEnd, issueStart } from "@/lib/dates";
import type { IssueNode } from "@/lib/queries";

export interface BlockEdge {
  blockedId: string;
  blockerId: string;
}

/**
 * Linear `relations` of type "blocks" mean: this issue blocks relatedIssue.
 * So the dependency edge is blocker -> blocked.
 * Only edges where both endpoints are in `issues` are kept.
 */
export function buildBlockEdges(issues: IssueNode[]): BlockEdge[] {
  const present = new Set(issues.map((i) => i.id));
  const edges: BlockEdge[] = [];
  for (const i of issues) {
    for (const rel of i.relations.nodes) {
      if (
        rel.type === "blocks" &&
        rel.relatedIssue &&
        present.has(rel.relatedIssue.id)
      ) {
        edges.push({ blockerId: i.id, blockedId: rel.relatedIssue.id });
      }
    }
  }
  return edges;
}

function durationDays(i: IssueNode): number {
  const s = issueStart(i);
  const e = issueEnd(i);
  if (!e) {
    return 1;
  }
  return Math.max(1, differenceInCalendarDays(e, s) + 1);
}

/**
 * Longest dependency chain weighted by issue duration. Returns the set of
 * issue ids on that chain. DFS with memoisation; cycle-safe.
 */
export function criticalPath(
  issues: IssueNode[],
  edges: BlockEdge[]
): Set<string> {
  if (edges.length === 0) {
    return new Set();
  }
  const byId = new Map(issues.map((i) => [i.id, i]));
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const arr = adj.get(e.blockerId);
    if (arr) {
      arr.push(e.blockedId);
    } else {
      adj.set(e.blockerId, [e.blockedId]);
    }
  }

  const memoLen = new Map<string, number>();
  const memoNext = new Map<string, string | null>();
  const visiting = new Set<string>();

  function dfs(id: string): number {
    const cached = memoLen.get(id);
    if (cached !== undefined) {
      return cached;
    }
    if (visiting.has(id)) {
      return 0; // cycle guard
    }
    visiting.add(id);
    const node = byId.get(id);
    const w = node ? durationDays(node) : 1;
    let bestLen = w;
    let bestNext: string | null = null;
    for (const nxt of adj.get(id) ?? []) {
      const sub = dfs(nxt);
      if (w + sub > bestLen) {
        bestLen = w + sub;
        bestNext = nxt;
      }
    }
    visiting.delete(id);
    memoLen.set(id, bestLen);
    memoNext.set(id, bestNext);
    return bestLen;
  }

  let startId: string | null = null;
  let best = -1;
  for (const i of issues) {
    const len = dfs(i.id);
    if (len > best) {
      best = len;
      startId = i.id;
    }
  }

  const path = new Set<string>();
  let cur = startId;
  while (cur) {
    path.add(cur);
    cur = memoNext.get(cur) ?? null;
  }
  return path;
}
