import { mockNow } from "@/lib/data/mock-data";
import type { AuditPhase, BudgetByPhase, Control, DemoTimeEntry, TimeSourceSummary } from "@/types/audit";

type SyncedHoursOptions = {
  activePhase?: AuditPhase;
  budgetByPhase: BudgetByPhase[];
  controls: Control[];
  syncCount?: number;
  syncReferenceTime?: string;
};

export type SyncedHoursData = {
  budgetByPhase: BudgetByPhase[];
  controls: Control[];
  lastSyncedAt: string;
  sourceSummaries: TimeSourceSummary[];
  syncCount: number;
  timeEntries: DemoTimeEntry[];
  totalActualHours: number;
  totalPlannedHours: number;
};

const MAX_SYNC_COUNT = 4;

export function getNormalizedSyncCount(rawValue: string | number | undefined) {
  const parsed = typeof rawValue === "number" ? rawValue : Number.parseInt(rawValue ?? "0", 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.min(MAX_SYNC_COUNT, parsed);
}

export function getSyncedHoursData({
  activePhase = "Reporting",
  budgetByPhase,
  controls,
  syncCount = 0,
  syncReferenceTime = mockNow,
}: SyncedHoursOptions): SyncedHoursData {
  const normalizedSyncCount = getNormalizedSyncCount(syncCount);
  const actualHoursByPhase = new Map<AuditPhase, number>([
    ["Planning", 0],
    ["Fieldwork", 0],
    ["Reporting", 0],
  ]);

  const normalizedControls = controls.map((control) => ({
    ...control,
    actualHours: roundToQuarter(Math.max(control.actualHours, 0)),
  }));

  for (const control of normalizedControls) {
    actualHoursByPhase.set(activePhase, roundToQuarter((actualHoursByPhase.get(activePhase) ?? 0) + control.actualHours));
  }

  const normalizedBudgetByPhase = budgetByPhase.map((phaseBudget) => ({
    ...phaseBudget,
    actualHours: actualHoursByPhase.get(phaseBudget.phase) ?? 0,
  }));

  return {
    budgetByPhase: normalizedBudgetByPhase,
    controls: normalizedControls,
    lastSyncedAt: syncReferenceTime,
    sourceSummaries: [] as TimeSourceSummary[],
    syncCount: normalizedSyncCount,
    timeEntries: [] as DemoTimeEntry[],
    totalActualHours: normalizedControls.reduce((sum, control) => sum + control.actualHours, 0),
    totalPlannedHours: normalizedControls.reduce((sum, control) => sum + control.plannedHours, 0),
  };
}

export function formatSourceSummary(sourceSummaries: TimeSourceSummary[]) {
  if (sourceSummaries.length === 0) {
    return "Recorded audit hours";
  }

  return sourceSummaries.map((summary) => `${summary.source} ${summary.totalHours.toFixed(0)}h`).join(" · ");
}

function roundToQuarter(value: number) {
  return Math.round(value * 4) / 4;
}
