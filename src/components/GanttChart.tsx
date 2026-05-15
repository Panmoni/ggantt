import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
} from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUpdateIssueDueDate } from "@/hooks/useUpdateIssueDueDate";
import { useUpdateIssueTitle } from "@/hooks/useUpdateIssueTitle";
import {
  computeRange,
  dateToX,
  dayTicks,
  dueRisk,
  issueEnd,
  issueStart,
  isWeekend,
  monthTicks,
  weekTicks,
  xToDate,
} from "@/lib/dates";
import { buildBlockEdges, criticalPath } from "@/lib/deps";
import { type GroupBy, groupIssues } from "@/lib/filters";
import {
  type FontScale,
  GANTT_METRICS,
  loadLeftWidth,
  MAX_LEFT_WIDTH,
  MIN_LEFT_WIDTH,
  saveLeftWidth,
} from "@/lib/prefs";
import type { IssueNode } from "@/lib/queries";
import { safeHref } from "@/lib/safeHref";

const RISK_STROKE: Record<string, string> = {
  overdue: "#dc2626",
  "at-risk": "#d97706",
};

const HEADER_H = 52;
const BAR_PAD = 6;
const UNSCHEDULED_STUB_DAYS = 3;

type Zoom = "day" | "week" | "month";
const ZOOM_PX: Record<Zoom, number> = { day: 40, week: 20, month: 6 };

const STATE_FILL: Record<string, string> = {
  backlog: "#cbd5e1",
  unstarted: "#94a3b8",
  started: "#3b82f6",
  completed: "#22c55e",
  canceled: "#d4d4d8",
  triage: "#f59e0b",
};

function rowBg(isSelected: boolean, idx: number): string {
  if (isSelected) {
    return "bg-blue-50";
  }
  return idx % 2 === 1 ? "bg-slate-50/60" : "";
}

function barStrokeWidth(
  riskStroke: string | undefined,
  isScheduled: boolean
): number {
  if (riskStroke) {
    return 2;
  }
  return isScheduled ? 0 : 1;
}

interface IssueRow {
  end: Date | null;
  issue: IssueNode;
  kind: "issue";
  start: Date;
}
interface GroupRow {
  bandEnd?: Date;
  bandStart?: Date;
  count: number;
  kind: "group";
  label: string;
  span: number;
}
type LayoutRow = IssueRow | GroupRow;

interface Drag {
  id: string;
  moved: boolean;
  originalEnd: Date | null;
  previewEnd: Date;
  start: Date;
}

function sortIssueRows(rows: IssueRow[]): IssueRow[] {
  const byStart = (a: IssueRow, b: IssueRow) =>
    a.start.getTime() - b.start.getTime();
  const unscheduled = rows.filter((r) => !r.end).sort(byStart);
  const scheduled = rows.filter((r) => r.end).sort(byStart);
  return [...unscheduled, ...scheduled];
}

export function GanttChart({
  issues,
  groupBy,
  fontScale,
}: {
  issues: IssueNode[];
  groupBy: GroupBy;
  fontScale: FontScale;
}) {
  const [zoom, setZoom] = useState<Zoom>("week");
  const [leftW, setLeftW] = useState(loadLeftWidth);
  const pxPerDay = ZOOM_PX[zoom];
  const { rowH: ROW_H, titleClass, idClass } = GANTT_METRICS[fontScale];

  const { range, rows } = useMemo(() => {
    const range = computeRange(issues);
    const groups = groupIssues(issues, groupBy);
    const layout: LayoutRow[] = [];
    for (const g of groups) {
      const issueRows: IssueRow[] = g.issues.map((issue) => ({
        kind: "issue" as const,
        issue,
        start: issueStart(issue),
        end: issueEnd(issue),
      }));
      const sorted = sortIssueRows(issueRows);
      if (groupBy !== "flat") {
        const cyc =
          groupBy === "cycle"
            ? g.issues.find((i) => i.cycle)?.cycle
            : undefined;
        layout.push({
          kind: "group",
          label: g.label,
          count: sorted.length,
          span: sorted.length,
          ...(cyc
            ? {
                bandStart: startOfDay(parseISO(cyc.startsAt)),
                bandEnd: startOfDay(parseISO(cyc.endsAt)),
              }
            : {}),
        });
      }
      layout.push(...sorted);
    }
    return { range, rows: layout };
  }, [issues, groupBy]);

  const { overdueCount, atRiskCount } = useMemo(() => {
    let overdueCount = 0;
    let atRiskCount = 0;
    for (const r of rows) {
      if (r.kind !== "issue" || !r.end) {
        continue;
      }
      const risk = dueRisk(r.end, r.issue.state.type);
      if (risk === "overdue") {
        overdueCount += 1;
      } else if (risk === "at-risk") {
        atRiskCount += 1;
      }
    }
    return { overdueCount, atRiskCount };
  }, [rows]);

  const [showDeps, setShowDeps] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(
    null
  );
  const titleMutation = useUpdateIssueTitle();
  const mutation = useUpdateIssueDueDate();
  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;

  const commitTitle = useCallback(() => {
    setEditing((e) => {
      if (e) {
        const v = e.value.trim();
        if (v) {
          titleMutation.mutate({ id: e.id, title: v });
        }
      }
      return null;
    });
  }, [titleMutation]);

  const issuesById = useMemo(
    () => new Map(issues.map((i) => [i.id, i])),
    [issues]
  );
  const issuesByIdRef = useRef(issuesById);
  issuesByIdRef.current = issuesById;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const shiftById = useCallback((id: string, deltaDays: number) => {
    const iss = issuesByIdRef.current.get(id);
    if (!iss?.dueDate) {
      return;
    }
    const nd = format(addDays(parseISO(iss.dueDate), deltaDays), "yyyy-MM-dd");
    mutateRef.current({ id, dueDate: nd });
  }, []);

  const shiftSelected = useCallback(
    (deltaDays: number) => {
      for (const id of selectedRef.current) {
        shiftById(id, deltaDays);
      }
    },
    [shiftById]
  );

  const chartW = range.days * pxPerDay;
  const bodyH = rows.length * ROW_H;
  const totalH = HEADER_H + bodyH;

  const edges = useMemo(() => buildBlockEdges(issues), [issues]);
  const critical = useMemo(() => criticalPath(issues, edges), [issues, edges]);

  const posById = useMemo(() => {
    const m = new Map<string, { startX: number; endX: number; midY: number }>();
    for (const [idx, r] of rows.entries()) {
      if (r.kind !== "issue") {
        continue;
      }
      const end = r.end ?? addDays(r.start, UNSCHEDULED_STUB_DAYS);
      const sx = dateToX(r.start, range.min, pxPerDay);
      const w = Math.max(
        dateToX(end, range.min, pxPerDay) - sx + pxPerDay,
        pxPerDay
      );
      m.set(r.issue.id, {
        startX: sx,
        endX: sx + w,
        midY: HEADER_H + idx * ROW_H + ROW_H / 2,
      });
    }
    return m;
  }, [rows, range.min, pxPerDay, ROW_H]);

  const months = monthTicks(range);
  const ticks = pxPerDay >= 14 ? dayTicks(range) : weekTicks(range);
  const todayX = dateToX(new Date(), range.min, pxPerDay);
  const todayVisible = todayX >= 0 && todayX <= chartW;

  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);

  const updateDrag = useCallback((d: Drag | null) => {
    dragRef.current = d;
    setDrag(d);
  }, []);

  const resizeRef = useRef<{ startX: number; startW: number } | null>(null);
  const [resizing, setResizing] = useState(false);

  const beginResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizeRef.current = { startX: e.clientX, startW: leftW };
      setResizing(true);
    },
    [leftW]
  );

  useEffect(() => {
    if (!resizing) {
      return;
    }
    const onMove = (e: MouseEvent) => {
      const r = resizeRef.current;
      if (!r) {
        return;
      }
      const next = Math.min(
        MAX_LEFT_WIDTH,
        Math.max(MIN_LEFT_WIDTH, r.startW + (e.clientX - r.startX))
      );
      setLeftW(next);
    };
    const onUp = () => {
      resizeRef.current = null;
      setResizing(false);
      setLeftW((w) => {
        saveLeftWidth(w);
        return w;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing]);

  const clientXToDate = useCallback(
    (clientX: number): Date | null => {
      const svg = svgRef.current;
      if (!svg) {
        return null;
      }
      const x = clientX - svg.getBoundingClientRect().left;
      return xToDate(x, range.min, pxPerDay);
    },
    [range.min, pxPerDay]
  );

  const isDragging = drag !== null;
  useEffect(() => {
    if (!isDragging) {
      return;
    }
    const onMove = (e: MouseEvent) => {
      const cur = dragRef.current;
      if (!cur) {
        return;
      }
      const dt = clientXToDate(e.clientX);
      if (!dt) {
        return;
      }
      updateDrag({
        ...cur,
        previewEnd: dt < cur.start ? cur.start : dt,
        moved: true,
      });
    };
    const onUp = () => {
      const cur = dragRef.current;
      updateDrag(null);
      if (!cur?.moved) {
        return;
      }
      const next = format(cur.previewEnd, "yyyy-MM-dd");
      const orig = cur.originalEnd
        ? format(cur.originalEnd, "yyyy-MM-dd")
        : null;
      if (next !== orig) {
        mutateRef.current({ id: cur.id, dueDate: next });
        // Bulk drag: if the dragged issue is part of a multi-selection
        // and had a real due date, shift every other selected issue's
        // due date by the same whole-day delta.
        const sel = selectedRef.current;
        if (cur.originalEnd && sel.has(cur.id) && sel.size > 1) {
          const delta = differenceInCalendarDays(
            cur.previewEnd,
            cur.originalEnd
          );
          if (delta !== 0) {
            for (const sid of sel) {
              if (sid !== cur.id) {
                shiftById(sid, delta);
              }
            }
          }
        }
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, clientXToDate, updateDrag]);

  return (
    <div>
      {mutation.isError && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">
          Couldn't save due date — reverted.{" "}
          {mutation.error instanceof Error ? mutation.error.message : ""}
        </div>
      )}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-slate-500 text-sm">Zoom:</span>
        {(["day", "week", "month"] as Zoom[]).map((z) => (
          <button
            className={`rounded px-3 py-1 text-sm capitalize transition ${
              zoom === z
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            key={z}
            onClick={() => setZoom(z)}
            type="button"
          >
            {z}
          </button>
        ))}
        <label className="ml-3 flex items-center gap-1.5 text-slate-600 text-sm">
          <input
            checked={showDeps}
            className="accent-slate-900"
            onChange={(e) => setShowDeps(e.target.checked)}
            type="checkbox"
          />
          Dependencies
          {edges.length > 0 && (
            <span className="text-slate-400 text-xs">({edges.length})</span>
          )}
        </label>
        <span className="ml-auto flex items-center gap-3 text-xs">
          {overdueCount > 0 && (
            <span className="font-medium text-red-600">
              {overdueCount} overdue
            </span>
          )}
          {atRiskCount > 0 && (
            <span className="font-medium text-amber-600">
              {atRiskCount} due soon
            </span>
          )}
          <span className="text-slate-400">
            {rows.filter((r) => r.kind === "issue" && !r.end).length}{" "}
            unscheduled ·{" "}
            {rows.filter((r) => r.kind === "issue" && r.end).length} scheduled
          </span>
        </span>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
          <span className="font-medium text-blue-900">
            {selected.size} selected
          </span>
          <span className="text-blue-700">— shift due dates:</span>
          {(
            [
              ["−1w", -7],
              ["−1d", -1],
              ["+1d", 1],
              ["+1w", 7],
            ] as [string, number][]
          ).map(([label, d]) => (
            <button
              className="rounded border border-blue-300 bg-white px-2 py-0.5 text-blue-800 hover:bg-blue-100"
              key={label}
              onClick={() => shiftSelected(d)}
              type="button"
            >
              {label}
            </button>
          ))}
          <span className="text-blue-600 text-xs">
            or drag any selected bar
          </span>
          <button
            className="ml-auto text-blue-600 hover:underline"
            onClick={() => setSelected(new Set())}
            type="button"
          >
            Clear
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded border border-slate-200">
        <div className="flex" style={{ width: leftW + chartW }}>
          {/* Left sticky label column */}
          <div
            className="sticky left-0 z-20 shrink-0 border-slate-200 border-r bg-white"
            style={{ width: leftW }}
          >
            {/* Drag handle to resize the issue column */}
            <button
              aria-label="Resize issue column"
              className={`absolute top-0 -right-1 z-30 h-full w-2 cursor-col-resize border-0 bg-transparent p-0 hover:bg-blue-200/50 ${
                resizing ? "bg-blue-300/60" : ""
              }`}
              onMouseDown={beginResize}
              type="button"
            />
            <div
              className="flex items-end border-slate-200 border-b px-3 pb-2 font-medium text-slate-500 text-xs uppercase tracking-wide"
              style={{ height: HEADER_H }}
            >
              Issue
            </div>
            {rows.map((r, idx) =>
              r.kind === "group" ? (
                <div
                  className="flex items-center gap-2 border-slate-200 border-y bg-slate-100 px-3 font-semibold text-slate-700 text-xs"
                  key={`g-${r.label}-${idx}`}
                  style={{ height: ROW_H }}
                >
                  <span className="truncate">{r.label}</span>
                  <span className="text-slate-400">({r.count})</span>
                </div>
              ) : (
                <div
                  className={`flex items-center gap-2 px-3 ${rowBg(
                    selected.has(r.issue.id),
                    idx
                  )} hover:bg-slate-100`}
                  key={r.issue.id}
                  style={{ height: ROW_H }}
                >
                  <input
                    checked={selected.has(r.issue.id)}
                    className="shrink-0 accent-blue-600"
                    onChange={() => toggleSelected(r.issue.id)}
                    title="Select for bulk shift"
                    type="checkbox"
                  />
                  <span className={`font-mono text-slate-400 ${idClass}`}>
                    <a
                      className="hover:underline"
                      href={safeHref(r.issue.url)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {r.issue.identifier}
                    </a>
                  </span>
                  {editing?.id === r.issue.id ? (
                    <input
                      autoFocus
                      className={`min-w-0 flex-1 rounded border border-blue-300 px-1 text-slate-900 outline-none ${titleClass}`}
                      onBlur={commitTitle}
                      onChange={(e) =>
                        setEditing({
                          id: r.issue.id,
                          value: e.target.value,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          commitTitle();
                        } else if (e.key === "Escape") {
                          setEditing(null);
                        }
                      }}
                      value={editing.value}
                    />
                  ) : (
                    <span
                      className={`min-w-0 flex-1 cursor-text truncate text-slate-800 ${titleClass}`}
                      onDoubleClick={() =>
                        setEditing({
                          id: r.issue.id,
                          value: r.issue.title,
                        })
                      }
                      title="Double-click to rename"
                    >
                      {r.issue.title}
                    </span>
                  )}
                </div>
              )
            )}
          </div>

          {/* Right SVG chart */}
          <svg
            aria-label="Gantt chart"
            className="block select-none"
            height={totalH}
            ref={svgRef}
            role="img"
            width={chartW}
          >
            <defs>
              <marker
                id="ggantt-arrow"
                markerHeight="6"
                markerWidth="6"
                orient="auto-start-reverse"
                refX="6"
                refY="4"
                viewBox="0 0 8 8"
              >
                <path d="M0,0 L8,4 L0,8 z" fill="#94a3b8" />
              </marker>
              <marker
                id="ggantt-arrow-crit"
                markerHeight="6"
                markerWidth="6"
                orient="auto-start-reverse"
                refX="6"
                refY="4"
                viewBox="0 0 8 8"
              >
                <path d="M0,0 L8,4 L0,8 z" fill="#7c3aed" />
              </marker>
            </defs>
            {/* Weekend shading (only at day zoom) */}
            {pxPerDay >= 14 &&
              dayTicks(range).map((d) =>
                isWeekend(d) ? (
                  <rect
                    fill="#f8fafc"
                    height={bodyH}
                    key={`wk-${d.toISOString()}`}
                    width={pxPerDay}
                    x={dateToX(d, range.min, pxPerDay)}
                    y={HEADER_H}
                  />
                ) : null
              )}

            {/* Alternating row backgrounds */}
            {rows.map((_r, idx) =>
              idx % 2 === 1 ? (
                <rect
                  fill="#f8fafc"
                  height={ROW_H}
                  key={`row-${idx}`}
                  opacity={0.6}
                  width={chartW}
                  x={0}
                  y={HEADER_H + idx * ROW_H}
                />
              ) : null
            )}

            {/* Vertical gridlines */}
            {ticks.map((d) => {
              const x = dateToX(d, range.min, pxPerDay);
              return (
                <line
                  key={`tick-${d.toISOString()}`}
                  stroke="#e2e8f0"
                  strokeWidth={1}
                  x1={x}
                  x2={x}
                  y1={HEADER_H}
                  y2={totalH}
                />
              );
            })}

            {/* Month dividers + labels */}
            {months.map((m) => {
              const x = dateToX(m, range.min, pxPerDay);
              return (
                <g key={`m-${m.toISOString()}`}>
                  <line
                    stroke="#cbd5e1"
                    strokeWidth={1}
                    x1={x}
                    x2={x}
                    y1={0}
                    y2={totalH}
                  />
                  <text
                    className="fill-slate-600"
                    fontSize={12}
                    fontWeight={600}
                    x={x + 6}
                    y={16}
                  >
                    {format(m, "MMM yyyy")}
                  </text>
                </g>
              );
            })}

            {/* Day/week tick labels */}
            {ticks.map((d) => {
              const x = dateToX(d, range.min, pxPerDay);
              return (
                <text
                  className="fill-slate-400"
                  fontSize={10}
                  key={`lbl-${d.toISOString()}`}
                  x={x + 3}
                  y={HEADER_H - 8}
                >
                  {pxPerDay >= 14 ? format(d, "d") : format(d, "MMM d")}
                </text>
              );
            })}

            {/* Today line */}
            {todayVisible && (
              <g>
                <line
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  x1={todayX}
                  x2={todayX}
                  y1={0}
                  y2={totalH}
                />
                <text
                  className="fill-red-500"
                  fontSize={10}
                  fontWeight={600}
                  x={todayX + 4}
                  y={HEADER_H - 24}
                >
                  Today
                </text>
              </g>
            )}

            {/* Cycle date bands (group-by cycle) */}
            {rows.map((r, idx) => {
              if (r.kind !== "group" || !r.bandStart || !r.bandEnd) {
                return null;
              }
              const bx = dateToX(r.bandStart, range.min, pxPerDay);
              const bw =
                dateToX(r.bandEnd, range.min, pxPerDay) - bx + pxPerDay;
              const bandH = (r.span + 1) * ROW_H;
              return (
                <g key={`cyc-${idx}`}>
                  <rect
                    fill="#6366f1"
                    fillOpacity={0.07}
                    height={bandH}
                    width={bw}
                    x={bx}
                    y={HEADER_H + idx * ROW_H}
                  />
                  <line
                    stroke="#6366f1"
                    strokeOpacity={0.4}
                    x1={bx}
                    x2={bx}
                    y1={HEADER_H + idx * ROW_H}
                    y2={HEADER_H + idx * ROW_H + bandH}
                  />
                  <line
                    stroke="#6366f1"
                    strokeOpacity={0.4}
                    x1={bx + bw}
                    x2={bx + bw}
                    y1={HEADER_H + idx * ROW_H}
                    y2={HEADER_H + idx * ROW_H + bandH}
                  />
                </g>
              );
            })}

            {/* Group header bands */}
            {rows.map((r, idx) =>
              r.kind === "group" ? (
                <rect
                  fill="#f1f5f9"
                  fillOpacity={0.85}
                  height={ROW_H}
                  key={`gb-${idx}`}
                  width={chartW}
                  x={0}
                  y={HEADER_H + idx * ROW_H}
                />
              ) : null
            )}

            {/* Bars */}
            {rows.map((r, idx) => {
              if (r.kind === "group") {
                return null;
              }
              const y = HEADER_H + idx * ROW_H + BAR_PAD;
              const h = ROW_H - BAR_PAD * 2;
              const x = dateToX(r.start, range.min, pxPerDay);
              const fill = STATE_FILL[r.issue.state.type] ?? "#94a3b8";

              const dragging = drag?.id === r.issue.id;
              const effEnd = dragging ? drag.previewEnd : r.end;
              const saving =
                mutation.isPending && mutation.variables?.id === r.issue.id;

              const handleStart =
                r.end ?? addDays(r.start, UNSCHEDULED_STUB_DAYS);
              const beginDrag = (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                updateDrag({
                  id: r.issue.id,
                  start: r.start,
                  originalEnd: r.end,
                  previewEnd: r.end ?? handleStart,
                  moved: false,
                });
              };

              const isScheduled = effEnd !== null;
              const barEnd = effEnd ?? handleStart;
              const w = Math.max(
                dateToX(barEnd, range.min, pxPerDay) - x + pxPerDay,
                pxPerDay
              );
              const gripX = x + w - 6;
              const risk = isScheduled
                ? dueRisk(barEnd, r.issue.state.type)
                : "ok";
              const riskStroke = RISK_STROKE[risk];

              const tip = isScheduled
                ? `${r.issue.identifier} · ${r.issue.title}\n${format(
                    r.start,
                    "yyyy-MM-dd"
                  )} → ${format(barEnd, "yyyy-MM-dd")}\n${
                    r.issue.state.name
                  }\nDrag to change due date`
                : `${r.issue.identifier} · ${r.issue.title}\nstart ${format(
                    r.start,
                    "yyyy-MM-dd"
                  )} · no due date\nDrag to set a due date\n${
                    r.issue.state.name
                  }`;

              return (
                <g
                  key={`bar-${r.issue.id}`}
                  onMouseDown={beginDrag}
                  style={{ cursor: "ew-resize" }}
                >
                  <title>{tip}</title>
                  <rect
                    fill={fill}
                    fillOpacity={isScheduled ? 1 : 0.3}
                    height={h}
                    rx={3}
                    stroke={riskStroke ?? fill}
                    strokeDasharray={isScheduled ? undefined : "4 3"}
                    strokeWidth={barStrokeWidth(riskStroke, isScheduled)}
                    width={w}
                    x={x}
                    y={y}
                  />
                  {/* visible resize grip */}
                  <rect
                    fill="#ffffff"
                    fillOpacity={0.9}
                    height={h - 4}
                    pointerEvents="none"
                    rx={1}
                    width={4}
                    x={gripX}
                    y={y + 2}
                  />
                  {saving && (
                    <rect
                      fill="#0f172a"
                      fillOpacity={0.15}
                      height={h}
                      pointerEvents="none"
                      rx={3}
                      width={w}
                      x={x}
                      y={y}
                    >
                      <animate
                        attributeName="fill-opacity"
                        dur="1s"
                        repeatCount="indefinite"
                        values="0.05;0.25;0.05"
                      />
                    </rect>
                  )}
                  {dragging && (
                    <text
                      className="fill-slate-700"
                      fontSize={10}
                      fontWeight={600}
                      pointerEvents="none"
                      x={x + w + 4}
                      y={y + h - 2}
                    >
                      {format(barEnd, "MMM d")}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Critical-path bar outlines */}
            {showDeps &&
              rows.map((r, idx) => {
                if (r.kind !== "issue" || !critical.has(r.issue.id)) {
                  return null;
                }
                const p = posById.get(r.issue.id);
                if (!p) {
                  return null;
                }
                return (
                  <rect
                    fill="none"
                    height={ROW_H - BAR_PAD * 2 + 3}
                    key={`cp-${r.issue.id}`}
                    pointerEvents="none"
                    rx={4}
                    stroke="#7c3aed"
                    strokeWidth={2}
                    width={p.endX - p.startX + 3}
                    x={p.startX - 1.5}
                    y={HEADER_H + idx * ROW_H + BAR_PAD - 1.5}
                  />
                );
              })}

            {/* Dependency arrows */}
            {showDeps &&
              edges.map((e, i) => {
                const a = posById.get(e.blockerId);
                const b = posById.get(e.blockedId);
                if (!(a && b)) {
                  return null;
                }
                const isCrit =
                  critical.has(e.blockerId) && critical.has(e.blockedId);
                const sx = a.endX;
                const sy = a.midY;
                const tx = b.startX;
                const ty = b.midY;
                const dx = Math.max(16, Math.abs(tx - sx) / 2);
                const d = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${
                  tx - dx
                } ${ty}, ${tx} ${ty}`;
                return (
                  <path
                    d={d}
                    fill="none"
                    key={`dep-${i}`}
                    markerEnd={
                      isCrit ? "url(#ggantt-arrow-crit)" : "url(#ggantt-arrow)"
                    }
                    pointerEvents="none"
                    stroke={isCrit ? "#7c3aed" : "#94a3b8"}
                    strokeOpacity={isCrit ? 0.95 : 0.6}
                    strokeWidth={isCrit ? 2 : 1.25}
                  />
                );
              })}
          </svg>
        </div>
      </div>
    </div>
  );
}
