import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
} from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUpdateProjectDates } from "@/hooks/useUpdateProjectDates";
import { dateToX, monthTicks, rangeFromPairs, xToDate } from "@/lib/dates";
import type { ProjectNode } from "@/lib/queries";
import { safeHref } from "@/lib/safeHref";

const ROW_H = 34;
const HEADER_H = 52;
const LEFT_W = 320;
const BAR_PAD = 7;
const DEFAULT_SPAN_DAYS = 14;

type Zoom = "week" | "month" | "quarter";
const ZOOM_PX: Record<Zoom, number> = { week: 16, month: 5, quarter: 2 };

type DragMode = "start" | "end" | "move";

interface Drag {
  end: Date;
  endReal: boolean;
  grab: Date;
  id: string;
  mode: DragMode;
  moved: boolean;
  origEnd: Date;
  origStart: Date;
  start: Date;
  startReal: boolean;
}

interface Row {
  end: Date;
  endReal: boolean;
  project: ProjectNode;
  start: Date;
  startReal: boolean;
}

function projDates(p: ProjectNode): {
  start: Date;
  end: Date;
  startReal: boolean;
  endReal: boolean;
} {
  const s = p.startDate ? startOfDay(parseISO(p.startDate)) : null;
  const t = p.targetDate ? startOfDay(parseISO(p.targetDate)) : null;
  if (s && t) {
    return { start: s, end: t, startReal: true, endReal: true };
  }
  if (s) {
    return {
      start: s,
      end: addDays(s, DEFAULT_SPAN_DAYS),
      startReal: true,
      endReal: false,
    };
  }
  if (t) {
    return {
      start: addDays(t, -DEFAULT_SPAN_DAYS),
      end: t,
      startReal: false,
      endReal: true,
    };
  }
  const today = startOfDay(new Date());
  return {
    start: today,
    end: addDays(today, DEFAULT_SPAN_DAYS),
    startReal: false,
    endReal: false,
  };
}

export function ProjectGantt({ projects }: { projects: ProjectNode[] }) {
  const [zoom, setZoom] = useState<Zoom>("week");
  const pxPerDay = ZOOM_PX[zoom];

  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const mutation = useUpdateProjectDates();
  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;

  const updateDrag = useCallback((d: Drag | null) => {
    dragRef.current = d;
    setDrag(d);
  }, []);

  const { range, rows } = useMemo(() => {
    const rows: Row[] = projects
      .map((project) => ({ project, ...projDates(project) }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    const range = rangeFromPairs(rows.map((r) => [r.start, r.end]));
    return { range, rows };
  }, [projects]);

  const chartW = range.days * pxPerDay;
  const totalH = HEADER_H + rows.length * ROW_H;
  const months = monthTicks(range);
  const todayX = dateToX(new Date(), range.min, pxPerDay);
  const todayVisible = todayX >= 0 && todayX <= chartW;

  const clientXToDate = useCallback(
    (clientX: number): Date | null => {
      const svg = svgRef.current;
      if (!svg) {
        return null;
      }
      return xToDate(
        clientX - svg.getBoundingClientRect().left,
        range.min,
        pxPerDay
      );
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
      if (cur.mode === "end") {
        updateDrag({
          ...cur,
          end: dt < cur.start ? cur.start : dt,
          moved: true,
        });
      } else if (cur.mode === "start") {
        updateDrag({
          ...cur,
          start: dt > cur.end ? cur.end : dt,
          moved: true,
        });
      } else {
        const deltaDays = differenceInCalendarDays(dt, cur.grab);
        updateDrag({
          ...cur,
          start: addDays(cur.origStart, deltaDays),
          end: addDays(cur.origEnd, deltaDays),
          moved: true,
        });
      }
    };
    const onUp = () => {
      const cur = dragRef.current;
      updateDrag(null);
      if (!cur?.moved) {
        return;
      }
      // Only persist a date if it was already set in Linear, or the user
      // directly grabbed that edge (start/end handle) to set it. A plain
      // "move" never invents a date that was never set — otherwise resizing
      // a target-only project would fabricate a bogus start date.
      const writeStart = cur.startReal || cur.mode === "start";
      const writeEnd = cur.endReal || cur.mode === "end";
      mutateRef.current({
        id: cur.id,
        startDate: writeStart ? format(cur.start, "yyyy-MM-dd") : null,
        targetDate: writeEnd ? format(cur.end, "yyyy-MM-dd") : null,
      });
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
          Couldn't save project dates — reverted.{" "}
          {mutation.error instanceof Error ? mutation.error.message : ""}
        </div>
      )}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-slate-500 text-sm">Zoom:</span>
        {(["week", "month", "quarter"] as Zoom[]).map((z) => (
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
        <span className="ml-auto text-slate-400 text-xs">
          {rows.length} project{rows.length === 1 ? "" : "s"} · drag either edge
        </span>
      </div>

      <div className="overflow-x-auto rounded border border-slate-200">
        <div className="flex" style={{ width: LEFT_W + chartW }}>
          <div
            className="sticky left-0 z-10 shrink-0 border-slate-200 border-r bg-white"
            style={{ width: LEFT_W }}
          >
            <div
              className="flex items-end border-slate-200 border-b px-3 pb-2 font-medium text-slate-500 text-xs uppercase tracking-wide"
              style={{ height: HEADER_H }}
            >
              Project
            </div>
            {rows.map((r, idx) => (
              <a
                className={`flex items-center px-3 ${
                  idx % 2 === 1 ? "bg-slate-50/60" : ""
                } hover:bg-slate-100`}
                href={safeHref(r.project.url)}
                key={r.project.id}
                rel="noreferrer"
                style={{ height: ROW_H }}
                target="_blank"
              >
                <span className="truncate text-slate-800 text-sm">
                  {r.project.name}
                </span>
              </a>
            ))}
          </div>

          <svg
            aria-label="Project Gantt chart"
            className="block select-none"
            height={totalH}
            ref={svgRef}
            role="img"
            width={chartW}
          >
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

            {months.map((m) => {
              const mx = dateToX(m, range.min, pxPerDay);
              return (
                <g key={`m-${m.toISOString()}`}>
                  <line stroke="#cbd5e1" x1={mx} x2={mx} y1={0} y2={totalH} />
                  <text
                    className="fill-slate-600"
                    fontSize={12}
                    fontWeight={600}
                    x={mx + 6}
                    y={16}
                  >
                    {format(m, "MMM yyyy")}
                  </text>
                </g>
              );
            })}

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

            {rows.map((r, idx) => {
              const dragging = drag?.id === r.project.id;
              const start = dragging ? drag.start : r.start;
              const end = dragging ? drag.end : r.end;
              const saving =
                mutation.isPending && mutation.variables?.id === r.project.id;

              const y = HEADER_H + idx * ROW_H + BAR_PAD;
              const h = ROW_H - BAR_PAD * 2;
              const x = dateToX(start, range.min, pxPerDay);
              const w = Math.max(
                dateToX(end, range.min, pxPerDay) - x + pxPerDay,
                pxPerDay
              );
              const fill = r.project.color || "#6366f1";

              const beginDrag = (mode: DragMode) => (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                const grab = clientXToDate(e.clientX) ?? r.start;
                updateDrag({
                  id: r.project.id,
                  mode,
                  origStart: r.start,
                  origEnd: r.end,
                  grab,
                  start: r.start,
                  end: r.end,
                  startReal: r.startReal,
                  endReal: r.endReal,
                  moved: false,
                });
              };

              return (
                <g key={`bar-${r.project.id}`}>
                  <title>
                    {`${r.project.name}\n${format(
                      start,
                      "yyyy-MM-dd"
                    )} → ${format(
                      end,
                      "yyyy-MM-dd"
                    )}\nDrag middle to move · edges to resize`}
                  </title>
                  <rect
                    fill={fill}
                    height={h}
                    onMouseDown={beginDrag("move")}
                    rx={4}
                    style={{ cursor: "grab" }}
                    width={w}
                    x={x}
                    y={y}
                  />
                  <rect
                    fill="#0f172a"
                    fillOpacity={1 - Math.min(r.project.progress, 1)}
                    height={h}
                    opacity={0.08}
                    pointerEvents="none"
                    rx={4}
                    width={w}
                    x={x}
                    y={y}
                  />
                  {/* left grip / handle */}
                  <rect
                    fill="transparent"
                    height={h}
                    onMouseDown={beginDrag("start")}
                    style={{ cursor: "ew-resize" }}
                    width={9}
                    x={x - 1}
                    y={y}
                  />
                  <rect
                    fill="#ffffff"
                    fillOpacity={0.9}
                    height={h - 4}
                    pointerEvents="none"
                    rx={1}
                    width={3}
                    x={x + 2}
                    y={y + 2}
                  />
                  {/* right grip / handle */}
                  <rect
                    fill="transparent"
                    height={h}
                    onMouseDown={beginDrag("end")}
                    style={{ cursor: "ew-resize" }}
                    width={9}
                    x={x + w - 8}
                    y={y}
                  />
                  <rect
                    fill="#ffffff"
                    fillOpacity={0.9}
                    height={h - 4}
                    pointerEvents="none"
                    rx={1}
                    width={3}
                    x={x + w - 5}
                    y={y + 2}
                  />
                  {saving && (
                    <rect
                      fill="#0f172a"
                      fillOpacity={0.15}
                      height={h}
                      pointerEvents="none"
                      rx={4}
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
                      y={y + h - 3}
                    >
                      {format(start, "MMM d")} → {format(end, "MMM d")}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Project milestones (diamonds on the project's row) */}
            {rows.map((r, idx) =>
              r.project.projectMilestones.nodes
                .filter((ms) => ms.targetDate)
                .map((ms) => {
                  const mxRaw = ms.targetDate as string;
                  const mDate = startOfDay(parseISO(mxRaw));
                  const mx = dateToX(mDate, range.min, pxPerDay) + pxPerDay / 2;
                  const cy = HEADER_H + idx * ROW_H + ROW_H / 2;
                  const s = 5;
                  return (
                    <g key={`ms-${ms.id}`}>
                      <title>
                        {`◆ ${ms.name}\n${format(mDate, "yyyy-MM-dd")}`}
                      </title>
                      <path
                        d={`M ${mx} ${cy - s} L ${mx + s} ${cy} L ${mx} ${
                          cy + s
                        } L ${mx - s} ${cy} Z`}
                        fill="#0f172a"
                        stroke="#ffffff"
                        strokeWidth={1}
                      />
                    </g>
                  );
                })
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
