import { addDays, eachWeekOfInterval, format, startOfWeek } from "date-fns";
import { useMemo } from "react";
import { issueEnd, issueStart } from "@/lib/dates";
import type { IssueNode } from "@/lib/queries";

const CELL_W = 44;
const ROW_H = 36;
const LEFT_W = 200;

function intensity(n: number): string {
  if (n === 0) {
    return "bg-white";
  }
  if (n === 1) {
    return "bg-blue-100";
  }
  if (n === 2) {
    return "bg-blue-200";
  }
  if (n <= 4) {
    return "bg-blue-400 text-white";
  }
  return "bg-blue-600 text-white";
}

export function WorkloadView({ issues }: { issues: IssueNode[] }) {
  const { weeks, assignees, counts } = useMemo(() => {
    let min: Date | null = null;
    let max: Date | null = null;
    const spans: { who: string; s: Date; e: Date }[] = [];
    for (const i of issues) {
      if (i.state.type === "completed" || i.state.type === "canceled") {
        continue;
      }
      const s = issueStart(i);
      const e = issueEnd(i) ?? addDays(s, 1);
      spans.push({ who: i.assignee?.name ?? "Unassigned", s, e });
      if (!min || s < min) {
        min = s;
      }
      if (!max || e > max) {
        max = e;
      }
    }
    if (!(min && max)) {
      return { weeks: [], assignees: [], counts: new Map() };
    }
    const weeks = eachWeekOfInterval(
      { start: min, end: max },
      { weekStartsOn: 1 }
    );
    const assignees = [...new Set(spans.map((sp) => sp.who))].sort((a, b) =>
      a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b)
    );
    const counts = new Map<string, number>();
    for (const sp of spans) {
      const ws = startOfWeek(sp.s, { weekStartsOn: 1 });
      const we = startOfWeek(sp.e, { weekStartsOn: 1 });
      for (const w of weeks) {
        if (w >= ws && w <= we) {
          const k = `${sp.who}|${w.getTime()}`;
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
      }
    }
    return { weeks, assignees, counts };
  }, [issues]);

  if (weeks.length === 0) {
    return (
      <div className="rounded border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
        No active issues with dates to chart.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-slate-200">
      <div style={{ width: LEFT_W + weeks.length * CELL_W }}>
        <div className="flex">
          <div
            className="sticky left-0 z-10 shrink-0 border-slate-200 border-r border-b bg-slate-50 px-3 py-2 font-medium text-slate-500 text-xs uppercase tracking-wide"
            style={{ width: LEFT_W, height: ROW_H }}
          >
            Assignee
          </div>
          {weeks.map((w) => (
            <div
              className="shrink-0 border-slate-200 border-r border-b bg-slate-50 py-2 text-center text-[10px] text-slate-500"
              key={w.getTime()}
              style={{ width: CELL_W, height: ROW_H }}
            >
              {format(w, "MMM d")}
            </div>
          ))}
        </div>
        {assignees.map((who, rIdx) => (
          <div className="flex" key={who}>
            <div
              className={`sticky left-0 z-10 shrink-0 truncate border-slate-100 border-r border-b px-3 text-slate-800 text-sm ${
                rIdx % 2 === 1 ? "bg-slate-50/60" : "bg-white"
              }`}
              style={{
                width: LEFT_W,
                height: ROW_H,
                lineHeight: `${ROW_H}px`,
              }}
            >
              {who}
            </div>
            {weeks.map((w) => {
              const n = counts.get(`${who}|${w.getTime()}`) ?? 0;
              return (
                <div
                  className={`flex shrink-0 items-center justify-center border-slate-100 border-r border-b text-xs ${intensity(
                    n
                  )}`}
                  key={w.getTime()}
                  style={{ width: CELL_W, height: ROW_H }}
                  title={`${who} · week of ${format(w, "MMM d")} · ${n} active`}
                >
                  {n > 0 ? n : ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
