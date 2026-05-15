import { describe, expect, it } from "vitest";
import { emptyFilters } from "@/lib/filters";
import { parseUrl, toQuery } from "@/lib/urlState";

const VIEWS = ["gantt", "table", "calendar"];

describe("parseUrl", () => {
  it("falls back to defaults on an empty query", () => {
    const s = parseUrl("", "gantt", VIEWS);
    expect(s.view).toBe("gantt");
    expect(s.groupBy).toBe("flat");
    expect(s.filters.hideCompleted).toBe(true);
  });

  it("rejects an unknown groupBy and falls back to flat", () => {
    expect(parseUrl("?g=bogus", "gantt", VIEWS).groupBy).toBe("flat");
    expect(parseUrl("?g=team", "gantt", VIEWS).groupBy).toBe("team");
  });

  it("rejects an unknown view and falls back to the default", () => {
    expect(parseUrl("?v=bogus", "gantt", VIEWS).view).toBe("gantt");
    expect(parseUrl("?v=table", "gantt", VIEWS).view).toBe("table");
  });

  it("decodes set filters and the hide toggles", () => {
    const s = parseUrl("?tm=ENG,OPS&hc=0&hu=1", "gantt", VIEWS);
    expect([...s.filters.teams].sort()).toEqual(["ENG", "OPS"]);
    expect(s.filters.hideCompleted).toBe(false);
    expect(s.filters.hideUnscheduled).toBe(true);
  });
});

describe("toQuery / parseUrl round-trip", () => {
  it("preserves view, groupBy, sets, and toggles", () => {
    const filters = {
      ...emptyFilters(),
      teams: new Set(["ENG", "A, B"]),
      hideCompleted: false,
      hideUnscheduled: true,
    };
    const qs = toQuery({ view: "table", groupBy: "team", filters });
    const back = parseUrl(`?${qs}`, "gantt", VIEWS);
    expect(back.view).toBe("table");
    expect(back.groupBy).toBe("team");
    expect([...back.filters.teams].sort()).toEqual(["A, B", "ENG"]);
    expect(back.filters.hideCompleted).toBe(false);
    expect(back.filters.hideUnscheduled).toBe(true);
  });

  it("omits default groupBy and empty sets from the query", () => {
    const qs = toQuery({
      view: "gantt",
      groupBy: "flat",
      filters: emptyFilters(),
    });
    expect(qs).toBe("v=gantt");
  });
});
