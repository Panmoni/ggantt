import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
} from "date-fns";
import { describe, expect, it } from "vitest";
import {
  computeRange,
  dateToX,
  dueRisk,
  isWeekend,
  rangeFromPairs,
  xToDate,
} from "@/lib/dates";
import { makeIssue } from "@/lib/testFixtures";

const today = startOfDay(new Date());

describe("rangeFromPairs", () => {
  it("pads an empty range by 7 days each side around today", () => {
    const r = rangeFromPairs([]);
    expect(differenceInCalendarDays(r.min, today)).toBe(-7);
    expect(differenceInCalendarDays(r.max, today)).toBe(7);
    expect(r.days).toBe(15);
  });

  it("expands to cover the widest pair, padded by 7", () => {
    const start = addDays(today, -10);
    const end = addDays(today, 10);
    const r = rangeFromPairs([[start, end]]);
    expect(differenceInCalendarDays(r.min, start)).toBe(-7);
    expect(differenceInCalendarDays(r.max, end)).toBe(7);
    expect(r.days).toBe(differenceInCalendarDays(r.max, r.min) + 1);
  });

  it("ignores a null end but still covers the start", () => {
    const start = addDays(today, 30);
    const r = rangeFromPairs([[start, null]]);
    expect(differenceInCalendarDays(r.max, start)).toBe(7);
  });
});

describe("computeRange", () => {
  it("derives the range from issue start/due dates, always spanning today", () => {
    const createdAt = format(addDays(today, -20), "yyyy-MM-dd");
    const dueDate = format(addDays(today, 20), "yyyy-MM-dd");
    const r = computeRange([makeIssue({ createdAt, dueDate })]);
    expect(differenceInCalendarDays(r.min, parseISO(createdAt))).toBe(-7);
    expect(differenceInCalendarDays(r.max, parseISO(dueDate))).toBe(7);
  });
});

describe("dateToX / xToDate", () => {
  it("round-trips a whole-day offset", () => {
    const min = parseISO("2026-01-01");
    const pxPerDay = 20;
    const x = dateToX(addDays(min, 5), min, pxPerDay);
    expect(x).toBe(100);
    expect(xToDate(x, min, pxPerDay)).toEqual(addDays(min, 5));
  });

  it("rounds a fractional x to the nearest day", () => {
    const min = parseISO("2026-01-01");
    expect(xToDate(31, min, 20)).toEqual(addDays(min, 2));
  });
});

describe("isWeekend", () => {
  it("is true for Saturday and Sunday only", () => {
    expect(isWeekend(parseISO("2026-01-03"))).toBe(true); // Sat
    expect(isWeekend(parseISO("2026-01-04"))).toBe(true); // Sun
    expect(isWeekend(parseISO("2026-01-05"))).toBe(false); // Mon
  });
});

describe("dueRisk", () => {
  it("is ok when there is no due date", () => {
    expect(dueRisk(null, "started")).toBe("ok");
  });

  it("is ok for completed or canceled issues even if overdue", () => {
    const past = addDays(today, -5);
    expect(dueRisk(past, "completed")).toBe("ok");
    expect(dueRisk(past, "canceled")).toBe("ok");
  });

  it("flags overdue, at-risk, and ok by horizon", () => {
    expect(dueRisk(addDays(today, -1), "started")).toBe("overdue");
    expect(dueRisk(today, "started")).toBe("at-risk");
    expect(dueRisk(addDays(today, 3), "started")).toBe("at-risk");
    expect(dueRisk(addDays(today, 10), "started")).toBe("ok");
  });
});
