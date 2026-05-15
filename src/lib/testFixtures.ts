import type { IssueNode } from "@/lib/queries";

/**
 * Build a fully-typed IssueNode for unit tests. Pass only the fields a test
 * cares about; everything else gets a sane default.
 */
export function makeIssue(overrides: Partial<IssueNode> = {}): IssueNode {
  return {
    id: "i1",
    identifier: "ENG-1",
    title: "Test issue",
    url: "https://linear.app/x/issue/ENG-1",
    createdAt: "2026-01-01",
    startedAt: null,
    dueDate: null,
    estimate: null,
    assignee: null,
    project: null,
    cycle: null,
    relations: { nodes: [] },
    state: { id: "s1", name: "Todo", type: "unstarted", color: "#000" },
    team: { id: "t1", name: "Engineering", key: "ENG" },
    ...overrides,
  };
}
