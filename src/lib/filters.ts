import type { IssueNode } from "@/lib/queries";

export type GroupBy = "flat" | "project" | "team" | "cycle" | "assignee";

export interface Filters {
  assignees: Set<string>;
  cycles: Set<string>;
  hideCompleted: boolean;
  hideUnscheduled: boolean;
  projects: Set<string>;
  states: Set<string>;
  teams: Set<string>;
}

export function emptyFilters(): Filters {
  return {
    teams: new Set(),
    projects: new Set(),
    assignees: new Set(),
    states: new Set(),
    cycles: new Set(),
    hideUnscheduled: false,
    hideCompleted: true,
  };
}

const NO_PROJECT = "(no project)";
const NO_CYCLE = "(no cycle)";
const UNASSIGNED = "(unassigned)";

export function teamKey(i: IssueNode): string {
  return i.team.key;
}
export function projectKey(i: IssueNode): string {
  return i.project?.name ?? NO_PROJECT;
}
export function assigneeKey(i: IssueNode): string {
  return i.assignee?.name ?? UNASSIGNED;
}
export function stateKey(i: IssueNode): string {
  return i.state.type;
}
export function cycleKey(i: IssueNode): string {
  return i.cycle ? `Cycle ${i.cycle.number}` : NO_CYCLE;
}

export interface FilterOptions {
  assignees: string[];
  cycles: string[];
  projects: string[];
  states: string[];
  teams: string[];
}

function sortWithSentinelLast(values: string[], sentinel: string): string[] {
  return values.sort((a, b) => {
    if (a === sentinel) {
      return 1;
    }
    if (b === sentinel) {
      return -1;
    }
    return a.localeCompare(b);
  });
}

export function buildOptions(issues: IssueNode[]): FilterOptions {
  const teams = new Set<string>();
  const projects = new Set<string>();
  const assignees = new Set<string>();
  const states = new Set<string>();
  const cycles = new Set<string>();
  for (const i of issues) {
    teams.add(teamKey(i));
    projects.add(projectKey(i));
    assignees.add(assigneeKey(i));
    states.add(stateKey(i));
    cycles.add(cycleKey(i));
  }
  return {
    teams: [...teams].sort((a, b) => a.localeCompare(b)),
    projects: sortWithSentinelLast([...projects], NO_PROJECT),
    assignees: sortWithSentinelLast([...assignees], UNASSIGNED),
    states: [...states].sort((a, b) => a.localeCompare(b)),
    cycles: sortWithSentinelLast([...cycles], NO_CYCLE),
  };
}

function passes(set: Set<string>, value: string): boolean {
  return set.size === 0 || set.has(value);
}

export function applyFilters(issues: IssueNode[], f: Filters): IssueNode[] {
  return issues.filter((i) => {
    if (f.hideUnscheduled && !i.dueDate) {
      return false;
    }
    if (f.hideCompleted && i.state.type === "completed") {
      return false;
    }
    return (
      passes(f.teams, teamKey(i)) &&
      passes(f.projects, projectKey(i)) &&
      passes(f.assignees, assigneeKey(i)) &&
      passes(f.states, stateKey(i)) &&
      passes(f.cycles, cycleKey(i))
    );
  });
}

const GROUP_FN: Record<Exclude<GroupBy, "flat">, (i: IssueNode) => string> = {
  project: projectKey,
  team: teamKey,
  cycle: cycleKey,
  assignee: assigneeKey,
};

export interface IssueGroup {
  issues: IssueNode[];
  label: string;
}

export function groupIssues(
  issues: IssueNode[],
  groupBy: GroupBy
): IssueGroup[] {
  if (groupBy === "flat") {
    return [{ label: "", issues }];
  }
  const fn = GROUP_FN[groupBy];
  const map = new Map<string, IssueNode[]>();
  for (const i of issues) {
    const k = fn(i);
    const arr = map.get(k);
    if (arr) {
      arr.push(i);
    } else {
      map.set(k, [i]);
    }
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, groupIssues]) => ({ label, issues: groupIssues }));
}
