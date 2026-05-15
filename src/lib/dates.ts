import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  parseISO,
  startOfDay,
} from "date-fns";
import type { IssueNode } from "@/lib/queries";

export function issueStart(i: IssueNode): Date {
  return startOfDay(parseISO(i.startedAt ?? i.createdAt));
}

export function issueEnd(i: IssueNode): Date | null {
  return i.dueDate ? startOfDay(parseISO(i.dueDate)) : null;
}

export interface DateRange {
  days: number;
  max: Date;
  min: Date;
}

const PAD_DAYS = 7;

export function computeRange(issues: IssueNode[]): DateRange {
  const today = startOfDay(new Date());
  let min = today;
  let max = today;

  for (const i of issues) {
    const s = issueStart(i);
    if (s < min) {
      min = s;
    }
    if (s > max) {
      max = s;
    }
    const e = issueEnd(i);
    if (e) {
      if (e < min) {
        min = e;
      }
      if (e > max) {
        max = e;
      }
    }
  }

  min = addDays(min, -PAD_DAYS);
  max = addDays(max, PAD_DAYS);
  return { min, max, days: differenceInCalendarDays(max, min) + 1 };
}

export function rangeFromPairs(pairs: [Date, Date | null][]): DateRange {
  const today = startOfDay(new Date());
  let min = today;
  let max = today;
  for (const [s, e] of pairs) {
    if (s < min) {
      min = s;
    }
    if (s > max) {
      max = s;
    }
    if (e) {
      if (e < min) {
        min = e;
      }
      if (e > max) {
        max = e;
      }
    }
  }
  min = addDays(min, -PAD_DAYS);
  max = addDays(max, PAD_DAYS);
  return { min, max, days: differenceInCalendarDays(max, min) + 1 };
}

export function dateToX(date: Date, min: Date, pxPerDay: number): number {
  return differenceInCalendarDays(startOfDay(date), min) * pxPerDay;
}

export function xToDate(x: number, min: Date, pxPerDay: number): Date {
  return addDays(min, Math.round(x / pxPerDay));
}

export function dayTicks(r: DateRange): Date[] {
  return eachDayOfInterval({ start: r.min, end: r.max });
}

export function weekTicks(r: DateRange): Date[] {
  return eachWeekOfInterval({ start: r.min, end: r.max }, { weekStartsOn: 1 });
}

export function monthTicks(r: DateRange): Date[] {
  return eachMonthOfInterval({ start: r.min, end: r.max });
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

export type RiskLevel = "overdue" | "at-risk" | "ok";

const AT_RISK_DAYS = 3;

export function dueRisk(due: Date | null, stateType: string): RiskLevel {
  if (!due || stateType === "completed" || stateType === "canceled") {
    return "ok";
  }
  const today = startOfDay(new Date());
  const days = differenceInCalendarDays(startOfDay(due), today);
  if (days < 0) {
    return "overdue";
  }
  if (days <= AT_RISK_DAYS) {
    return "at-risk";
  }
  return "ok";
}
