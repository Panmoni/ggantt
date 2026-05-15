import {
  emptyFilters,
  type Filters,
  type GroupBy,
  isGroupBy,
} from "@/lib/filters";

export interface UrlState {
  filters: Filters;
  groupBy: GroupBy;
  view: string;
}

const SET_KEYS = [
  ["teams", "tm"],
  ["projects", "pr"],
  ["assignees", "as"],
  ["states", "st"],
  ["cycles", "cy"],
] as const;

export function parseUrl(
  search: string,
  defaultView: string,
  validViews: readonly string[]
): UrlState {
  const p = new URLSearchParams(search);
  const filters = emptyFilters();
  for (const [field, key] of SET_KEYS) {
    const raw = p.get(key);
    if (raw) {
      filters[field] = new Set(raw.split(",").map(decodeURIComponent));
    }
  }
  if (p.get("hc") === "0") {
    filters.hideCompleted = false;
  }
  if (p.get("hu") === "1") {
    filters.hideUnscheduled = true;
  }
  const rawView = p.get("v");
  const rawGroup = p.get("g");
  return {
    view: rawView && validViews.includes(rawView) ? rawView : defaultView,
    groupBy: rawGroup && isGroupBy(rawGroup) ? rawGroup : "flat",
    filters,
  };
}

export function toQuery(s: UrlState): string {
  const p = new URLSearchParams();
  p.set("v", s.view);
  if (s.groupBy !== "flat") {
    p.set("g", s.groupBy);
  }
  for (const [field, key] of SET_KEYS) {
    const set = s.filters[field];
    if (set.size > 0) {
      p.set(key, [...set].map(encodeURIComponent).join(","));
    }
  }
  if (!s.filters.hideCompleted) {
    p.set("hc", "0");
  }
  if (s.filters.hideUnscheduled) {
    p.set("hu", "1");
  }
  return p.toString();
}
