import { describe, expect, it } from "vitest";
import { buildBlockEdges, criticalPath } from "@/lib/deps";
import type { IssueNode } from "@/lib/queries";
import { makeIssue } from "@/lib/testFixtures";

function blocks(targetId: string): IssueNode["relations"] {
  return { nodes: [{ type: "blocks", relatedIssue: { id: targetId } }] };
}

describe("buildBlockEdges", () => {
  it("keeps blocks edges where both endpoints are present", () => {
    const a = makeIssue({ id: "A", relations: blocks("B") });
    const b = makeIssue({ id: "B" });
    expect(buildBlockEdges([a, b])).toEqual([
      { blockerId: "A", blockedId: "B" },
    ]);
  });

  it("drops edges whose target is not in the set", () => {
    const a = makeIssue({ id: "A", relations: blocks("missing") });
    expect(buildBlockEdges([a])).toEqual([]);
  });

  it("ignores non-blocks relation types", () => {
    const a = makeIssue({
      id: "A",
      relations: { nodes: [{ type: "related", relatedIssue: { id: "B" } }] },
    });
    const b = makeIssue({ id: "B" });
    expect(buildBlockEdges([a, b])).toEqual([]);
  });
});

describe("criticalPath", () => {
  it("returns an empty set when there are no edges", () => {
    expect(criticalPath([makeIssue()], []).size).toBe(0);
  });

  it("picks the longest duration-weighted chain", () => {
    // A (1d) -> B (1d) -> C (5d) is heavier than the A -> D (1d) branch.
    const a = makeIssue({ id: "A", createdAt: "2026-01-01" });
    const b = makeIssue({ id: "B", createdAt: "2026-01-01" });
    const c = makeIssue({
      id: "C",
      createdAt: "2026-01-01",
      dueDate: "2026-01-05",
    });
    const d = makeIssue({ id: "D", createdAt: "2026-01-01" });
    const edges = [
      { blockerId: "A", blockedId: "B" },
      { blockerId: "B", blockedId: "C" },
      { blockerId: "A", blockedId: "D" },
    ];
    const path = criticalPath([a, b, c, d], edges);
    expect([...path].sort()).toEqual(["A", "B", "C"]);
  });

  it("is cycle-safe", () => {
    const a = makeIssue({ id: "A" });
    const b = makeIssue({ id: "B" });
    const edges = [
      { blockerId: "A", blockedId: "B" },
      { blockerId: "B", blockedId: "A" },
    ];
    const path = criticalPath([a, b], edges);
    expect(path.size).toBeGreaterThan(0);
    expect(path.size).toBeLessThanOrEqual(2);
  });
});
