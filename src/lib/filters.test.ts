import { describe, expect, it } from "vitest";
import {
  applyFilters,
  buildOptions,
  emptyFilters,
  groupIssues,
} from "@/lib/filters";
import { makeIssue } from "@/lib/testFixtures";

const completedState = {
  id: "s",
  name: "Done",
  type: "completed",
  color: "#0f0",
};

describe("emptyFilters", () => {
  it("hides completed by default and shows unscheduled", () => {
    const f = emptyFilters();
    expect(f.hideCompleted).toBe(true);
    expect(f.hideUnscheduled).toBe(false);
    expect(f.teams.size).toBe(0);
  });
});

describe("buildOptions", () => {
  it("sorts options and pushes the sentinel last", () => {
    const issues = [
      makeIssue({ id: "1", project: null }),
      makeIssue({
        id: "2",
        project: {
          id: "p",
          name: "Beta",
          startDate: null,
          targetDate: null,
        },
      }),
      makeIssue({
        id: "3",
        project: {
          id: "p2",
          name: "Alpha",
          startDate: null,
          targetDate: null,
        },
      }),
    ];
    expect(buildOptions(issues).projects).toEqual([
      "Alpha",
      "Beta",
      "(no project)",
    ]);
  });
});

describe("applyFilters", () => {
  it("hides done, cancelled, and duplicate issues when hideCompleted is set", () => {
    const issues = [
      makeIssue({ id: "open" }),
      makeIssue({ id: "done", state: completedState }),
      makeIssue({
        id: "cancelled",
        state: { id: "c", name: "Cancelled", type: "canceled", color: "#999" },
      }),
      makeIssue({
        id: "duplicate",
        state: { id: "d", name: "Duplicate", type: "canceled", color: "#999" },
      }),
    ];
    const result = applyFilters(issues, emptyFilters());
    expect(result.map((i) => i.id)).toEqual(["open"]);
  });

  it("hides unscheduled issues when hideUnscheduled is set", () => {
    const issues = [
      makeIssue({ id: "noDue" }),
      makeIssue({ id: "due", dueDate: "2026-02-01" }),
    ];
    const result = applyFilters(issues, {
      ...emptyFilters(),
      hideUnscheduled: true,
    });
    expect(result.map((i) => i.id)).toEqual(["due"]);
  });

  it("filters by an active set", () => {
    const issues = [
      makeIssue({ id: "eng", team: { id: "t", name: "Eng", key: "ENG" } }),
      makeIssue({ id: "ops", team: { id: "t2", name: "Ops", key: "OPS" } }),
    ];
    const result = applyFilters(issues, {
      ...emptyFilters(),
      teams: new Set(["OPS"]),
    });
    expect(result.map((i) => i.id)).toEqual(["ops"]);
  });
});

describe("groupIssues", () => {
  it("returns a single unlabeled group for flat", () => {
    const issues = [makeIssue(), makeIssue({ id: "2" })];
    const groups = groupIssues(issues, "flat");
    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe("");
    expect(groups[0]?.issues).toHaveLength(2);
  });

  it("groups by key with labels sorted ascending", () => {
    const issues = [
      makeIssue({ id: "1", team: { id: "t2", name: "Ops", key: "OPS" } }),
      makeIssue({ id: "2", team: { id: "t1", name: "Eng", key: "ENG" } }),
    ];
    const groups = groupIssues(issues, "team");
    expect(groups.map((g) => g.label)).toEqual(["ENG", "OPS"]);
  });
});
