import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useCallback, useMemo, useState } from "react";
import { useUpdateIssueDueDate } from "@/hooks/useUpdateIssueDueDate";
import type { IssueNode } from "@/lib/queries";
import { safeHref } from "@/lib/safeHref";

type CalMode = "month" | "week" | "quarter" | "range";

const MODES: { id: CalMode; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "quarter", label: "Quarter" },
  { id: "range", label: "Range" },
];

const RANGE_LENGTHS = [4, 7, 14];

const STATE_DOT: Record<string, string> = {
  backlog: "bg-slate-400",
  unstarted: "bg-slate-500",
  started: "bg-blue-500",
  completed: "bg-green-500",
  canceled: "bg-zinc-400",
  triage: "bg-amber-500",
};

const TODAY = startOfDay(new Date());

function isPastDay(day: Date): boolean {
  return isBefore(day, TODAY);
}

function dayNumClass(today: boolean, muted: boolean): string {
  if (today) {
    return "inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 font-semibold text-white";
  }
  return muted ? "text-slate-300" : "text-slate-600";
}

function miniDayClass(today: boolean, inMonth: boolean): string {
  if (today) {
    return "rounded-full bg-red-500 font-semibold text-white";
  }
  return inMonth ? "text-slate-600" : "text-slate-300";
}

function isOverdue(day: Date, issue: IssueNode): boolean {
  return (
    isPastDay(day) &&
    issue.state.type !== "completed" &&
    issue.state.type !== "canceled"
  );
}

function dueKey(issue: IssueNode): string | null {
  return issue.dueDate ? format(parseISO(issue.dueDate), "yyyy-MM-dd") : null;
}

function IssueChip({
  issue,
  overdue,
  compact,
}: {
  issue: IssueNode;
  overdue: boolean;
  compact?: boolean;
}) {
  return (
    <a
      className={`flex cursor-grab items-center gap-1 truncate rounded px-1 py-0.5 hover:bg-slate-100 active:cursor-grabbing ${
        compact ? "text-[11px]" : "text-xs"
      } ${overdue ? "text-red-600" : "text-slate-700"}`}
      draggable
      href={safeHref(issue.url)}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/issue-id", issue.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      rel="noreferrer"
      target="_blank"
      title={`${issue.identifier} · ${issue.title} · ${issue.state.name}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          STATE_DOT[issue.state.type] ?? "bg-slate-400"
        }`}
      />
      <span className="truncate">{issue.title}</span>
    </a>
  );
}

function DayCell({
  day,
  items,
  inMonth,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  day: Date;
  items: IssueNode[];
  inMonth: boolean;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const today = isToday(day);
  const past = isPastDay(day);
  const muted = !inMonth || past;
  const base = "flex min-h-0 flex-col border-slate-100 border-r border-b p-1.5";
  let bg: string;
  if (isDragOver) {
    bg = "bg-blue-50 ring-1 ring-blue-400 ring-inset";
  } else if (past) {
    bg = "bg-slate-50";
  } else if (inMonth) {
    bg = "bg-white";
  } else {
    bg = "bg-slate-50/50";
  }
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: calendar day cell is a drag-and-drop target with no semantic HTML equivalent
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: calendar day cell is a drag-and-drop target with no semantic HTML equivalent
    <div
      className={`${base} ${bg} ${past ? "opacity-60" : ""}`}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className={`mb-1 shrink-0 text-xs ${dayNumClass(today, muted)}`}>
        {format(day, "d")}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {items.map((i) => (
          <IssueChip issue={i} key={i.id} overdue={isOverdue(day, i)} />
        ))}
      </div>
    </div>
  );
}

export function CalendarView({ issues }: { issues: IssueNode[] }) {
  const [mode, setMode] = useState<CalMode>("month");
  const [anchor, setAnchor] = useState(() => startOfMonth(new Date()));
  const [rangeLen, setRangeLen] = useState(4);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const { mutate: setDueDate } = useUpdateIssueDueDate();

  const handleDrop = useCallback(
    (e: React.DragEvent, dayKey: string) => {
      e.preventDefault();
      setDragOver(null);
      const id = e.dataTransfer.getData("text/issue-id");
      if (!id) {
        return;
      }
      const issue = issues.find((i) => i.id === id);
      if (!issue || issue.dueDate === dayKey) {
        return;
      }
      setDueDate({ id, dueDate: dayKey });
    },
    [issues, setDueDate]
  );

  const byDay = useMemo(() => {
    const m = new Map<string, IssueNode[]>();
    for (const i of issues) {
      const key = dueKey(i);
      if (!key) {
        continue;
      }
      const arr = m.get(key);
      if (arr) {
        arr.push(i);
      } else {
        m.set(key, [i]);
      }
    }
    return m;
  }, [issues]);

  const goToday = useCallback(() => {
    setAnchor(
      mode === "month" || mode === "quarter"
        ? startOfMonth(new Date())
        : startOfDay(new Date())
    );
  }, [mode]);

  const switchMode = useCallback((m: CalMode) => {
    setMode(m);
    setAnchor(
      m === "month" || m === "quarter"
        ? startOfMonth(new Date())
        : startOfDay(new Date())
    );
  }, []);

  const step = useCallback(
    (dir: 1 | -1) => {
      setAnchor((a) => {
        switch (mode) {
          case "month":
            return addMonths(a, dir);
          case "quarter":
            return addMonths(a, dir * 3);
          case "week":
            return addDays(a, dir * 7);
          default:
            return addDays(a, dir * rangeLen);
        }
      });
    },
    [mode, rangeLen]
  );

  const dragHandlers = useCallback(
    (key: string) => ({
      isDragOver: dragOver === key,
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragOver !== key) {
          setDragOver(key);
        }
      },
      onDragLeave: () => setDragOver((d) => (d === key ? null : d)),
      onDrop: (e: React.DragEvent) => handleDrop(e, key),
    }),
    [dragOver, handleDrop]
  );

  const { title, visibleCount } = useMemo(() => {
    let t: string;
    let days: Date[];
    if (mode === "month") {
      t = format(anchor, "MMMM yyyy");
      days = eachDayOfInterval({
        start: startOfMonth(anchor),
        end: endOfMonth(anchor),
      });
    } else if (mode === "quarter") {
      const last = addMonths(anchor, 2);
      t = `${format(anchor, "MMM")} – ${format(last, "MMM yyyy")}`;
      days = eachDayOfInterval({
        start: startOfMonth(anchor),
        end: endOfMonth(last),
      });
    } else {
      const len = mode === "week" ? 7 : rangeLen;
      const end = addDays(anchor, len - 1);
      t =
        format(anchor, "MMM d") +
        " – " +
        format(end, isSameMonth(anchor, end) ? "d, yyyy" : "MMM d, yyyy");
      days = eachDayOfInterval({ start: anchor, end });
    }
    const count = days.reduce(
      (n, d) => n + (byDay.get(format(d, "yyyy-MM-dd"))?.length ?? 0),
      0
    );
    return { title: t, visibleCount: count };
  }, [mode, anchor, rangeLen, byDay]);

  return (
    <div className="flex h-[calc(100vh-11.5rem)] flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button
          aria-label="Previous"
          className="rounded border border-slate-200 bg-white px-2 py-1 text-sm hover:bg-slate-100"
          onClick={() => step(-1)}
          type="button"
        >
          ‹
        </button>
        <h2 className="min-w-44 text-center font-semibold text-lg text-slate-900">
          {title}
        </h2>
        <button
          aria-label="Next"
          className="rounded border border-slate-200 bg-white px-2 py-1 text-sm hover:bg-slate-100"
          onClick={() => step(1)}
          type="button"
        >
          ›
        </button>
        <button
          className="rounded border border-slate-200 bg-white px-3 py-1 text-sm hover:bg-slate-100"
          onClick={goToday}
          type="button"
        >
          Today
        </button>

        <div className="flex overflow-hidden rounded border border-slate-200">
          {MODES.map((m) => (
            <button
              className={`px-3 py-1 text-sm transition ${
                mode === m.id
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-100"
              }`}
              key={m.id}
              onClick={() => switchMode(m.id)}
              type="button"
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === "range" && (
          <div className="flex overflow-hidden rounded border border-slate-200">
            {RANGE_LENGTHS.map((n) => (
              <button
                className={`px-2 py-1 text-sm transition ${
                  rangeLen === n
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-100"
                }`}
                key={n}
                onClick={() => setRangeLen(n)}
                type="button"
              >
                {n}d
              </button>
            ))}
          </div>
        )}

        <span className="ml-auto text-slate-400 text-xs">
          {visibleCount} due in view
        </span>
      </div>

      {mode === "month" && (
        <MonthGrid anchor={anchor} byDay={byDay} dragHandlers={dragHandlers} />
      )}
      {mode === "quarter" && <QuarterGrid anchor={anchor} byDay={byDay} />}
      {mode === "week" && (
        <Agenda
          byDay={byDay}
          days={eachDayOfInterval({
            start: anchor,
            end: addDays(anchor, 6),
          })}
        />
      )}
      {mode === "range" && (
        <RangeGrid
          byDay={byDay}
          days={eachDayOfInterval({
            start: anchor,
            end: addDays(anchor, rangeLen - 1),
          })}
          dragHandlers={dragHandlers}
        />
      )}
    </div>
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type DragHandlerFactory = (key: string) => {
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
};

function MonthGrid({
  anchor,
  byDay,
  dragHandlers,
}: {
  anchor: Date;
  byDay: Map<string, IssueNode[]>;
  dragHandlers: DragHandlerFactory;
}) {
  // Fixed 6-week (42-day) grid so the layout height is stable month to month.
  const gridStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({
    start: gridStart,
    end: addDays(gridStart, 41),
  });
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-slate-200 text-sm">
      <div className="grid shrink-0 grid-cols-7">
        {WEEKDAYS.map((d) => (
          <div
            className="border-slate-200 border-b bg-slate-50 px-2 py-1.5 font-medium text-slate-500 text-xs uppercase tracking-wide"
            key={d}
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          return (
            <DayCell
              day={day}
              inMonth={isSameMonth(day, anchor)}
              items={byDay.get(key) ?? []}
              key={key}
              {...dragHandlers(key)}
            />
          );
        })}
      </div>
    </div>
  );
}

function RangeGrid({
  days,
  byDay,
  dragHandlers,
}: {
  days: Date[];
  byDay: Map<string, IssueNode[]>;
  dragHandlers: DragHandlerFactory;
}) {
  return (
    <div
      className="grid min-h-0 flex-1 overflow-hidden rounded border border-slate-200 text-sm"
      style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
    >
      {days.map((day) => {
        const key = format(day, "yyyy-MM-dd");
        const past = isPastDay(day);
        return (
          <div className="flex min-h-0 flex-col" key={key}>
            <div
              className={`shrink-0 border-slate-200 border-b border-l px-2 py-1.5 text-xs ${
                isToday(day)
                  ? "bg-red-50 font-semibold text-red-600"
                  : "bg-slate-50 text-slate-500"
              }`}
            >
              {format(day, "EEE d")}
            </div>
            <div
              className={past ? "min-h-0 flex-1 opacity-60" : "min-h-0 flex-1"}
            >
              <DayCell
                day={day}
                inMonth
                items={byDay.get(key) ?? []}
                {...dragHandlers(key)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Agenda({
  days,
  byDay,
}: {
  days: Date[];
  byDay: Map<string, IssueNode[]>;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto rounded border border-slate-200">
      {days.map((day) => {
        const key = format(day, "yyyy-MM-dd");
        const items = byDay.get(key) ?? [];
        const past = isPastDay(day);
        return (
          <div
            className={`flex gap-4 border-slate-100 border-b px-3 py-2 ${
              past ? "bg-slate-50 opacity-60" : ""
            }`}
            key={key}
          >
            <div
              className={`w-28 shrink-0 text-sm ${
                isToday(day) ? "font-semibold text-red-600" : "text-slate-500"
              }`}
            >
              {format(day, "EEE, MMM d")}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {items.length === 0 ? (
                <span className="text-slate-300 text-xs">—</span>
              ) : (
                items.map((i) => (
                  <IssueChip issue={i} key={i.id} overdue={isOverdue(day, i)} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuarterGrid({
  anchor,
  byDay,
}: {
  anchor: Date;
  byDay: Map<string, IssueNode[]>;
}) {
  const months = [0, 1, 2].map((n) => startOfMonth(addMonths(anchor, n)));
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-3">
      {months.map((m) => (
        <MiniMonth byDay={byDay} key={m.toISOString()} month={m} />
      ))}
    </div>
  );
}

function MiniMonth({
  month,
  byDay,
}: {
  month: Date;
  byDay: Map<string, IssueNode[]>;
}) {
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({
    start: gridStart,
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  return (
    <div className="rounded border border-slate-200 p-2">
      <div className="mb-1 font-semibold text-slate-700 text-sm">
        {format(month, "MMMM yyyy")}
      </div>
      <div className="grid grid-cols-7 text-center">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, idx) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed weekday header labels
          <div className="py-0.5 text-[10px] text-slate-400" key={idx}>
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const items = byDay.get(key) ?? [];
          const inMonth = isSameMonth(day, month);
          const today = isToday(day);
          const past = isPastDay(day);
          return (
            <div
              className={`relative aspect-square ${past ? "opacity-50" : ""}`}
              key={key}
              title={
                items.length > 0
                  ? items.map((i) => `${i.identifier} ${i.title}`).join("\n")
                  : undefined
              }
            >
              <div
                className={`flex h-full flex-col items-center justify-center text-[11px] ${miniDayClass(
                  today,
                  inMonth
                )}`}
              >
                {format(day, "d")}
                {items.length > 0 && (
                  <span
                    className={`mt-0.5 h-1 w-1 rounded-full ${
                      today ? "bg-white" : "bg-blue-500"
                    }`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
