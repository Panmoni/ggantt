import { format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import type { IssueNode } from "@/lib/queries";
import { safeHref } from "@/lib/safeHref";

function fmtDate(s: string | null): string {
  if (!s) {
    return "—";
  }
  try {
    return format(parseISO(s), "yyyy-MM-dd");
  } catch {
    return s;
  }
}

const STATE_COLOR: Record<string, string> = {
  backlog: "bg-slate-200 text-slate-700",
  unstarted: "bg-slate-100 text-slate-700",
  started: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  canceled: "bg-zinc-100 text-zinc-500 line-through",
  triage: "bg-amber-100 text-amber-800",
};

type SortKey =
  | "id"
  | "title"
  | "state"
  | "priority"
  | "started"
  | "due"
  | "est"
  | "assignee"
  | "project"
  | "team";

type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "title", label: "Title" },
  { key: "state", label: "State" },
  { key: "priority", label: "Priority" },
  { key: "started", label: "Started" },
  { key: "due", label: "Due" },
  { key: "est", label: "Est" },
  { key: "assignee", label: "Assignee" },
  { key: "project", label: "Project" },
  { key: "team", label: "Team" },
];

// Returns a comparable value for a given sort key. Strings sort
// case-insensitively; missing values sort last regardless of direction.
function sortValue(i: IssueNode, key: SortKey): string | number | null {
  switch (key) {
    case "id":
      return i.identifier.toLowerCase();
    case "title":
      return i.title.toLowerCase();
    case "state":
      return i.state.name.toLowerCase();
    case "priority":
      // Linear uses 0 for "no priority"; treat it as missing so real
      // priorities (1 urgent … 4 low) sort ahead of unprioritised issues.
      return i.priority === 0 ? null : i.priority;
    case "started":
      return i.startedAt ?? i.createdAt;
    case "due":
      return i.dueDate;
    case "est":
      return i.estimate;
    case "assignee":
      return i.assignee?.name.toLowerCase() ?? null;
    case "project":
      return i.project?.name.toLowerCase() ?? null;
    case "team":
      return i.team.key.toLowerCase();
    default:
      return null;
  }
}

function compare(
  a: IssueNode,
  b: IssueNode,
  key: SortKey,
  dir: SortDir
): number {
  const av = sortValue(a, key);
  const bv = sortValue(b, key);
  if (av === bv) {
    return 0;
  }
  // Missing values always sort to the bottom.
  if (av === null || av === undefined) {
    return 1;
  }
  if (bv === null || bv === undefined) {
    return -1;
  }
  const cmp = av < bv ? -1 : 1;
  return dir === "asc" ? cmp : -cmp;
}

export function IssuesTable({ issues }: { issues: IssueNode[] }) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    if (!sortKey) {
      return issues;
    }
    return [...issues].sort((a, b) => compare(a, b, sortKey, sortDir));
  }, [issues, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="overflow-auto rounded border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500 text-xs uppercase tracking-wide">
          <tr>
            {COLUMNS.map((c) => {
              const active = sortKey === c.key;
              let ariaSort: "ascending" | "descending" | "none" = "none";
              if (active) {
                ariaSort = sortDir === "asc" ? "ascending" : "descending";
              }
              let indicator = "↕";
              if (active) {
                indicator = sortDir === "asc" ? "▲" : "▼";
              }
              return (
                <th aria-sort={ariaSort} className="px-3 py-2" key={c.key}>
                  <button
                    className="flex items-center gap-1 uppercase tracking-wide hover:text-slate-800"
                    onClick={() => toggleSort(c.key)}
                    type="button"
                  >
                    {c.label}
                    <span className="text-[10px] text-slate-400">
                      {indicator}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((i) => {
            const stateClass =
              STATE_COLOR[i.state.type] ?? "bg-slate-100 text-slate-700";
            return (
              <tr className="hover:bg-slate-50" key={i.id}>
                <td className="px-3 py-2 font-mono text-slate-500 text-xs">
                  <a
                    className="hover:underline"
                    href={safeHref(i.url)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {i.identifier}
                  </a>
                </td>
                <td className="px-3 py-2 text-slate-900">{i.title}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs ${stateClass}`}
                  >
                    {i.state.name}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {i.priority === 0 ? "—" : i.priorityLabel}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {fmtDate(i.startedAt ?? i.createdAt)}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {fmtDate(i.dueDate)}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {i.estimate ?? "—"}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {i.assignee?.name ?? "—"}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {i.project?.name ?? "—"}
                </td>
                <td className="px-3 py-2 text-slate-600">{i.team.key}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
