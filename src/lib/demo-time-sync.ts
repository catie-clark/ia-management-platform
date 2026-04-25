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
  const timeEntries = controls.flatMap((control, index) =>
    buildEntriesForControl(control, index, normalizedSyncCount, syncReferenceTime, activePhase),
  );
  const actualHoursByControl = new Map<string, number>();
  const actualHoursByPhase = new Map<AuditPhase, number>([
    ["Planning", 0],
    ["Fieldwork", 0],
    ["Reporting", 0],
  ]);

  for (const entry of timeEntries) {
    actualHoursByControl.set(entry.controlId, roundToQuarter((actualHoursByControl.get(entry.controlId) ?? 0) + entry.hours));
    actualHoursByPhase.set(entry.phase, roundToQuarter((actualHoursByPhase.get(entry.phase) ?? 0) + entry.hours));
  }

  const syncedControls = controls.map((control) => ({
    ...control,
    actualHours: actualHoursByControl.get(control.id) ?? 0,
  }));
  const syncedBudgetByPhase = budgetByPhase.map((phaseBudget) => ({
    ...phaseBudget,
    actualHours: actualHoursByPhase.get(phaseBudget.phase) ?? 0,
  }));
  const sourceSummaries = buildSourceSummaries(timeEntries);
  const totalActualHours = syncedControls.reduce((sum, control) => sum + control.actualHours, 0);
  const totalPlannedHours = syncedControls.reduce((sum, control) => sum + control.plannedHours, 0);

  return {
    budgetByPhase: syncedBudgetByPhase,
    controls: syncedControls,
    lastSyncedAt: addMinutes(syncReferenceTime, normalizedSyncCount * 17),
    sourceSummaries,
    syncCount: normalizedSyncCount,
    timeEntries: timeEntries.sort((left, right) => new Date(right.entryDate).getTime() - new Date(left.entryDate).getTime()),
    totalActualHours,
    totalPlannedHours,
  };
}

export function formatSourceSummary(sourceSummaries: TimeSourceSummary[]) {
  if (sourceSummaries.length === 0) {
    return "No synced time entries";
  }

  return sourceSummaries.map((summary) => `${summary.source} ${summary.totalHours.toFixed(0)}h`).join(" · ");
}

function buildEntriesForControl(
  control: Control,
  index: number,
  syncCount: number,
  syncReferenceTime: string,
  activePhase: AuditPhase,
) {
  const baselineHours = getConnectorBaselineHours(control, index, activePhase);
  const planningHours = getPlanningBaselineHours(control, index, baselineHours);
  const reportingHours = getReportingBaselineHours(control, baselineHours);
  const fieldworkHours = roundToQuarter(Math.max(0, baselineHours - planningHours - reportingHours));
  const entries: DemoTimeEntry[] = [];
  const planningBaselineHours = activePhase === "Planning" ? baselineHours : planningHours;
  const fieldworkBaselineHours =
    activePhase === "Planning" ? 0 : activePhase === "Fieldwork" ? roundToQuarter(fieldworkHours + reportingHours) : fieldworkHours;
  const reportingBaselineHours = activePhase === "Reporting" ? reportingHours : 0;

  if (planningBaselineHours > 0) {
    entries.push({
      id: `${control.id}-baseline-planning`,
      controlId: control.id,
      userId: control.ownerId,
      phase: "Planning",
      source: "Workday",
      hours: planningBaselineHours,
      entryDate: addMinutes(syncReferenceTime, -1 * (320 + index * 19)),
      workItemReference: `TS-${control.referenceId ?? control.id}-PLAN`,
    });
  }

  if (fieldworkBaselineHours > 0) {
    entries.push({
      id: `${control.id}-baseline-fieldwork-workday`,
      controlId: control.id,
      userId: control.ownerId,
      phase: "Fieldwork",
      source: "Workday",
      hours: fieldworkBaselineHours,
      entryDate: addMinutes(syncReferenceTime, -1 * (120 + index * 11)),
      workItemReference: `TS-${control.referenceId ?? control.id}-EXEC`,
    });
  }

  if (reportingBaselineHours > 0) {
    entries.push({
      id: `${control.id}-baseline-reporting`,
      controlId: control.id,
      userId: control.ownerId,
      phase: "Reporting",
      source: "Workday",
      hours: reportingBaselineHours,
      entryDate: addMinutes(syncReferenceTime, -1 * (70 + index * 7)),
      workItemReference: `TS-${control.referenceId ?? control.id}-RPT`,
    });
  }

  for (let step = 1; step <= syncCount; step += 1) {
    const deltaHours = getIncrementalSyncHours(control, index, step);

    if (deltaHours <= 0) {
      continue;
    }

    const phase = clampPhaseToActive(getIncrementalPhase(control, step), activePhase);
    entries.push({
      id: `${control.id}-sync-${step}`,
      controlId: control.id,
      userId: control.ownerId,
      phase,
      source: "Workday",
      hours: deltaHours,
      entryDate: addMinutes(syncReferenceTime, -1 * (step * 14 + index * 3)),
      workItemReference: `TS-${control.referenceId ?? control.id}-SYNC${step}`,
    });
  }

  return entries;
}

function getConnectorBaselineHours(control: Control, index: number, activePhase: AuditPhase) {
  const storedActualHours = Math.max(control.actualHours, 0);

  if (storedActualHours > 0) {
    return storedActualHours;
  }

  if (activePhase !== "Planning" || !hasPlanningSetup(control) || control.plannedHours <= 0) {
    return 0;
  }

  const simulatedPlanningHours = Math.min(control.plannedHours, 1.5 + (index % 3) * 0.75);
  return roundToQuarter(simulatedPlanningHours);
}

function hasPlanningSetup(control: Control) {
  return Boolean(control.assignedOwnerId || control.assignedDueDate || control.assignedPlannedHours);
}

function getPlanningBaselineHours(control: Control, index: number, baselineHours: number) {
  if (baselineHours === 0) {
    return 0;
  }

  const ratio = control.status === "NOT_STARTED" ? 0.7 : control.status === "COMPLETE" ? 0.18 : 0.24 + (index % 3) * 0.04;
  return roundToQuarter(Math.min(baselineHours, baselineHours * ratio));
}

function getReportingBaselineHours(control: Control, baselineHours: number) {
  if (baselineHours === 0) {
    return 0;
  }

  if (control.status === "COMPLETE") {
    return roundToQuarter(Math.min(baselineHours, baselineHours * 0.14));
  }

  if (control.status === "BLOCKED") {
    return roundToQuarter(Math.min(baselineHours, baselineHours * 0.05));
  }

  return 0;
}

function getIncrementalSyncHours(control: Control, index: number, step: number) {
  if (control.status === "COMPLETE" && step > 1) {
    return 0;
  }

  if (control.status === "NOT_STARTED") {
    return step === 1 ? roundToQuarter(0.5 + (index % 2) * 0.5) : 0;
  }

  const baseHours = 0.5 + ((index + step) % 3) * 0.25;

  if (control.status === "BLOCKED") {
    return step <= 2 ? roundToQuarter(baseHours) : 0;
  }

  return roundToQuarter(baseHours);
}

function getIncrementalPhase(control: Control, step: number): AuditPhase {
  if (control.status === "NOT_STARTED") {
    return "Planning";
  }

  if (control.status === "COMPLETE" || step >= 3) {
    return "Reporting";
  }

  return "Fieldwork";
}

function clampPhaseToActive(phase: AuditPhase, activePhase: AuditPhase): AuditPhase {
  if (activePhase === "Planning") {
    return "Planning";
  }

  if (activePhase === "Fieldwork" && phase === "Reporting") {
    return "Fieldwork";
  }

  return phase;
}

function buildSourceSummaries(entries: DemoTimeEntry[]) {
  const summaries = new Map<DemoTimeEntry["source"], TimeSourceSummary>();

  for (const entry of entries) {
    const current = summaries.get(entry.source) ?? {
      source: entry.source,
      entryCount: 0,
      totalHours: 0,
    };

    current.entryCount += 1;
    current.totalHours = roundToQuarter(current.totalHours + entry.hours);
    summaries.set(entry.source, current);
  }

  return Array.from(summaries.values()).sort((left, right) => right.totalHours - left.totalHours);
}

function roundToQuarter(value: number) {
  return Math.round(value * 4) / 4;
}

function addMinutes(value: string, minutes: number) {
  return new Date(new Date(value).getTime() + minutes * 60 * 1000).toISOString();
}
