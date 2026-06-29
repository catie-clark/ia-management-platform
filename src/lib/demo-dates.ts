/**
 * Demo date-shifting utilities.
 *
 * The demo always looks like we are in the middle of fieldwork:
 *  - planning completed ~2 days ago
 *  - fieldwork tollgate ~10 days out
 *  - a handful of overdue questions and requests
 *
 * Two mechanisms work together:
 *  1. getDemoPhaseDates() — returns phase-level timeline dates computed fresh
 *     from today's actual date. Use this wherever the lifecycle milestone chart
 *     or hours-budget phase-date display is rendered.
 *  2. shiftDemoDate() / computeAuditDemoOffset() / shiftByOffset() — shift
 *     operational dates (control due dates, question/request due dates, etc.)
 *     so that items that were "overdue" in the original dataset remain overdue
 *     relative to today.
 *
 * DEMO_REFERENCE_DATE is the approximate date the demo Supabase dataset was set
 * up. It is used as a fallback when a dynamic anchor is unavailable. Update it
 * if the dataset is rebuilt from scratch on a new date.
 */

const DEMO_REFERENCE_DATE = "2026-06-01";

// ---------------------------------------------------------------------------
// Phase date overrides  (milestone chart + hours-budget display)
// ---------------------------------------------------------------------------

function todayIsoDate(offsetDays: number, hour = 17): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays, hour, 0, 0, 0),
  ).toISOString();
}

/** Phase-level lifecycle dates computed fresh from today's date. */
export function getDemoPhaseDates() {
  return {
    planningStartDate: todayIsoDate(-21, 9),  // planning kicked off 3 weeks ago
    planningEndDate: todayIsoDate(-14, 17),   // planning wrapped up 2 weeks ago
    fieldworkStartDate: todayIsoDate(-14, 8), // fieldwork started same day planning closed
    fieldworkEndDate: todayIsoDate(10, 17),   // fieldwork tollgate in 10 days
    reportingStartDate: todayIsoDate(10, 8),  // reporting begins when fieldwork ends
    reportingEndDate: todayIsoDate(25, 17),   // audit filed in ~3.5 weeks
  };
}

// ---------------------------------------------------------------------------
// Operational date shifting  (controls, questions, requests, documents)
// ---------------------------------------------------------------------------

export function getDemoDateOffsetDays(): number {
  const ref = new Date(`${DEMO_REFERENCE_DATE}T12:00:00.000Z`);
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  return Math.round((today.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Computes the shift (days) needed so that the database's planning_end_date
 * appears as 2 days ago.  Falls back to getDemoDateOffsetDays() when no anchor
 * is available.
 */
export function computeAuditDemoOffset(planningEndDate: string | null): number {
  if (!planningEndDate) return getDemoDateOffsetDays();
  const anchor = new Date(planningEndDate.includes("T") ? planningEndDate : `${planningEndDate}T17:00:00.000Z`);
  if (Number.isNaN(anchor.getTime())) return getDemoDateOffsetDays();
  const target = new Date();
  target.setUTCHours(17, 0, 0, 0);
  target.setUTCDate(target.getUTCDate() - 14);
  return Math.round((target.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
}

export function shiftByOffset(dateStr: string | null, offsetDays: number): string | null {
  if (!dateStr || offsetDays === 0) return dateStr;
  const normalized = dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00.000Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return dateStr;
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString();
}

export function shiftDemoDate(dateStr: string): string;
export function shiftDemoDate(dateStr: string | null): string | null;
export function shiftDemoDate(dateStr: string | null): string | null {
  return shiftByOffset(dateStr, getDemoDateOffsetDays());
}

// ---------------------------------------------------------------------------
// Phase-window proportional scaling
// ---------------------------------------------------------------------------

/**
 * Proportionally scale a date from [dbWindowStart, dbWindowEnd] into
 * [demoWindowStart, demoWindowEnd].  Returns null when the source window is
 * missing, degenerate, or the input is null.
 */
export function scaleDemoDate(
  dateStr: string | null,
  dbWindowStart: string | null,
  dbWindowEnd: string | null,
  demoWindowStart: string,
  demoWindowEnd: string,
): string | null {
  if (!dateStr || !dbWindowStart || !dbWindowEnd) return null;
  const norm = (s: string) => (s.includes("T") ? s : `${s}T12:00:00.000Z`);
  const date = new Date(norm(dateStr)).getTime();
  const dbStart = new Date(norm(dbWindowStart)).getTime();
  const dbEnd = new Date(norm(dbWindowEnd)).getTime();
  const demoStart = new Date(demoWindowStart).getTime();
  const demoEnd = new Date(demoWindowEnd).getTime();
  if (Number.isNaN(date) || Number.isNaN(dbStart) || Number.isNaN(dbEnd) || dbEnd <= dbStart) return null;
  if (Number.isNaN(demoStart) || Number.isNaN(demoEnd) || demoEnd <= demoStart) return null;
  const position = Math.max(0, Math.min(1, (date - dbStart) / (dbEnd - dbStart)));
  return new Date(demoStart + position * (demoEnd - demoStart)).toISOString();
}

/**
 * Ensure no more than `maxOverdue` items have a dueDate before `nowIso`.
 * The most-overdue items (oldest due dates) are kept overdue; the rest are
 * pushed to deterministic future dates within [now + 1 day, futureWindowEnd].
 * Determinism uses the item id so the same record always lands on the same date.
 */
export function capOverdueItems<T extends { id: string; dueDate: string }>(
  items: T[],
  maxOverdue: number,
  nowIso: string,
  futureWindowEndIso: string,
): T[] {
  const nowMs = new Date(nowIso).getTime();
  const futureEnd = new Date(futureWindowEndIso).getTime();
  const futureWindowMs = Math.max(futureEnd - nowMs, 24 * 60 * 60 * 1000);

  const overdue = items
    .filter(item => new Date(item.dueDate).getTime() < nowMs)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  if (overdue.length <= maxOverdue) return items;

  const keepIds = new Set(overdue.slice(0, maxOverdue).map(item => item.id));

  return items.map(item => {
    if (new Date(item.dueDate).getTime() >= nowMs || keepIds.has(item.id)) return item;
    const hash = item.id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const offset = ((hash % 100) / 100) * futureWindowMs * 0.9 + 24 * 60 * 60 * 1000;
    return { ...item, dueDate: new Date(nowMs + offset).toISOString() };
  });
}

/**
 * Build a date transformer that proportionally maps dates from the range spanned
 * by rawDates into [demoWindowStart, demoWindowEnd].  Ensures no scaled date
 * exceeds the demo phase end.  Falls back to the global day-offset shift when
 * rawDates doesn't form a valid range (< 2 distinct values).
 */
export function buildPhaseScaler(
  rawDates: (string | null | undefined)[],
  demoWindowStart: string,
  demoWindowEnd: string,
): (dateStr: string | null) => string | null {
  const fallback = (d: string | null) => shiftByOffset(d, getDemoDateOffsetDays());

  const validTimes = rawDates
    .filter((d): d is string => typeof d === "string" && d.length > 0)
    .map(d => new Date(d.includes("T") ? d : `${d}T12:00:00.000Z`).getTime())
    .filter(t => !Number.isNaN(t));

  if (validTimes.length < 2) return fallback;

  const dbWindowStart = new Date(Math.min(...validTimes)).toISOString();
  const dbWindowEnd = new Date(Math.max(...validTimes)).toISOString();

  return (dateStr: string | null): string | null =>
    scaleDemoDate(dateStr, dbWindowStart, dbWindowEnd, demoWindowStart, demoWindowEnd) ??
    fallback(dateStr);
}
