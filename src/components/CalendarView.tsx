import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useMemo, useState } from "react";
import type { IssueNode } from "@/lib/queries";

const STATE_DOT: Record<string, string> = {
  backlog: "bg-slate-400",
  unstarted: "bg-slate-500",
  started: "bg-blue-500",
  completed: "bg-green-500",
  canceled: "bg-zinc-400",
  triage: "bg-amber-500",
};

function dayNumClass(today: boolean, inMonth: boolean): string {
  if (today) {
    return "inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 font-semibold text-white";
  }
  return inMonth ? "text-slate-600" : "text-slate-300";
}

export function CalendarView({ issues }: { issues: IssueNode[] }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const byDay = useMemo(() => {
    const m = new Map<string, IssueNode[]>();
    for (const i of issues) {
      if (!i.dueDate) {
        continue;
      }
      const key = format(parseISO(i.dueDate), "yyyy-MM-dd");
      const arr = m.get(key);
      if (arr) {
        arr.push(i);
      } else {
        m.set(key, [i]);
      }
    }
    return m;
  }, [issues]);

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  const dueThisMonth = useMemo(
    () =>
      issues.filter((i) => i.dueDate && isSameMonth(parseISO(i.dueDate), month))
        .length,
    [issues, month]
  );

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <button
          className="rounded border border-slate-200 bg-white px-2 py-1 text-sm hover:bg-slate-100"
          onClick={() => setMonth((m) => addMonths(m, -1))}
          type="button"
        >
          ‹
        </button>
        <h2 className="min-w-44 text-center font-semibold text-lg text-slate-900">
          {format(month, "MMMM yyyy")}
        </h2>
        <button
          className="rounded border border-slate-200 bg-white px-2 py-1 text-sm hover:bg-slate-100"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          type="button"
        >
          ›
        </button>
        <button
          className="rounded border border-slate-200 bg-white px-3 py-1 text-sm hover:bg-slate-100"
          onClick={() => setMonth(startOfMonth(new Date()))}
          type="button"
        >
          Today
        </button>
        <span className="ml-auto text-slate-400 text-xs">
          {dueThisMonth} due this month
        </span>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded border border-slate-200 text-sm">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div
            className="border-slate-200 border-b bg-slate-50 px-2 py-1.5 font-medium text-slate-500 text-xs uppercase tracking-wide"
            key={d}
          >
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const items = byDay.get(key) ?? [];
          const inMonth = isSameMonth(day, month);
          const today = isToday(day);
          return (
            <div
              className={`min-h-28 border-slate-100 border-r border-b p-1.5 ${
                inMonth ? "bg-white" : "bg-slate-50/50"
              }`}
              key={key}
            >
              <div className={`mb-1 text-xs ${dayNumClass(today, inMonth)}`}>
                {format(day, "d")}
              </div>
              <div className="flex flex-col gap-0.5">
                {items.slice(0, 5).map((i) => {
                  const overdue =
                    !today &&
                    day < new Date() &&
                    !isSameDay(day, new Date()) &&
                    i.state.type !== "completed" &&
                    i.state.type !== "canceled";
                  return (
                    <a
                      className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-xs hover:bg-slate-100 ${
                        overdue ? "text-red-600" : "text-slate-700"
                      }`}
                      href={i.url}
                      key={i.id}
                      rel="noreferrer"
                      target="_blank"
                      title={`${i.identifier} · ${i.title} · ${i.state.name}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          STATE_DOT[i.state.type] ?? "bg-slate-400"
                        }`}
                      />
                      <span className="truncate">{i.title}</span>
                    </a>
                  );
                })}
                {items.length > 5 && (
                  <span className="px-1 text-slate-400 text-xs">
                    +{items.length - 5} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
