import type { ReviewNote, User } from "@/types/audit";

export type ReviewNoteTesterStat = {
  key: string;
  name: string;
  role: string;
  total: number;
  open: number;
  resolved: number;
  avgClearHours: number | null;
};

export type ReviewNoteAnalytics = {
  hasData: boolean;
  total: number;
  open: number;
  cleared: number;
  closed: number;
  avgClearHours: number | null;
  medianClearHours: number | null;
  fastestClearHours: number | null;
  slowestClearHours: number | null;
  avgCloseHours: number | null;
  reopenedNoteCount: number;
  totalReopens: number;
  byTester: ReviewNoteTesterStat[];
};

function hoursBetween(from: string | undefined, to: string | undefined): number | null {
  if (!from || !to) {
    return null;
  }
  const diffMs = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return null;
  }
  return diffMs / 3_600_000;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Aggregate review-note throughput and timing: time-to-clear (raised -> cleared,
 * the tester's responsiveness), time-to-close (cleared -> closed, the reviewer's),
 * and churn (reopens) — by preparer (tester) and overall.
 */
export function getReviewNoteAnalytics({ notes, users }: { notes: ReviewNote[]; users: User[] }): ReviewNoteAnalytics {
  const userById = new Map(users.map((user) => [user.id, user]));
  const clearDurations: number[] = [];
  const closeDurations: number[] = [];

  const counts = { open: 0, cleared: 0, closed: 0 };
  let reopenedNoteCount = 0;
  let totalReopens = 0;

  const testerAccumulator = new Map<
    string,
    { name: string; role: string; total: number; open: number; resolved: number; clearHours: number[] }
  >();

  for (const note of notes) {
    switch (note.status) {
      case "OPEN":
        counts.open += 1;
        break;
      case "CLEARED":
        counts.cleared += 1;
        break;
      case "CLOSED":
        counts.closed += 1;
        break;
    }

    if (note.reopenCount > 0) {
      reopenedNoteCount += 1;
      totalReopens += note.reopenCount;
    }

    const clearHours = hoursBetween(note.createdAt, note.clearedAt);
    if (clearHours !== null) {
      clearDurations.push(clearHours);
    }

    const closeHours = hoursBetween(note.clearedAt, note.closedAt);
    if (closeHours !== null) {
      closeDurations.push(closeHours);
    }

    const key = note.assignedToUserId ?? note.assignedToName ?? "unassigned";
    const resolvedUser = note.assignedToUserId ? userById.get(note.assignedToUserId) : undefined;
    const stat = testerAccumulator.get(key) ?? {
      name: resolvedUser?.name ?? note.assignedToName ?? "Unassigned preparer",
      role: resolvedUser?.role ?? "STAFF",
      total: 0,
      open: 0,
      resolved: 0,
      clearHours: [],
    };
    stat.total += 1;
    if (note.status === "OPEN") {
      stat.open += 1;
    } else {
      stat.resolved += 1;
    }
    if (clearHours !== null) {
      stat.clearHours.push(clearHours);
    }
    testerAccumulator.set(key, stat);
  }

  const byTester: ReviewNoteTesterStat[] = Array.from(testerAccumulator.entries())
    .map(([key, stat]) => ({
      key,
      name: stat.name,
      role: stat.role,
      total: stat.total,
      open: stat.open,
      resolved: stat.resolved,
      avgClearHours: average(stat.clearHours),
    }))
    .sort((left, right) => right.total - left.total || left.name.localeCompare(right.name));

  return {
    hasData: notes.length > 0,
    total: notes.length,
    open: counts.open,
    cleared: counts.cleared,
    closed: counts.closed,
    avgClearHours: average(clearDurations),
    medianClearHours: median(clearDurations),
    fastestClearHours: clearDurations.length > 0 ? Math.min(...clearDurations) : null,
    slowestClearHours: clearDurations.length > 0 ? Math.max(...clearDurations) : null,
    avgCloseHours: average(closeDurations),
    reopenedNoteCount,
    totalReopens,
    byTester,
  };
}
