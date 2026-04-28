import { getControlVariance } from "@/lib/audit-logic";
import { normalizeAuditPhase } from "@/lib/audit-phase";
import { controls, users } from "@/lib/data/mock-data";
import { getNormalizedSyncCount, getSyncedHoursData } from "@/lib/demo-time-sync";
import {
  formatAuditScopePeriod,
  mapControl,
  mapUser,
  type AuditRecord,
  type BusinessUnitRow,
  type ControlRow,
  type DashboardMode,
  type UserRow,
} from "@/lib/live-audit";
import {
  buildLivePhaseBudgetPlan,
  getCurrentPhaseBudget,
  getPrototypePhaseBudgets,
  sumPhaseActualHours,
  sumPhasePlannedHours,
} from "@/lib/phase-budget";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AuditPhase, BudgetByPhase, Control, DemoTimeEntry, TimeSourceSummary, User } from "@/types/audit";

export type HoursByTester = {
  actualHours: number;
  id: string;
  name: string;
  role: User["role"];
};

export type HoursEntryRow = {
  controlLabel: string | null;
  entryDate: string;
  hours: number;
  id: string;
  ownerName: string;
  ownerRole: User["role"];
  phase: AuditPhase;
  workItemLabel: string;
};

export type HoursBudgetViewModel = {
  auditId: string | null;
  auditLabel: string;
  totalBudgetHours: number | null;
  auditPeriodEnd: string | null;
  auditPeriodLabel: string;
  auditPeriodStart: string | null;
  controls: Control[];
  currentPhase: "Planning" | "Fieldwork" | "Reporting";
  currentPhaseVariance: number;
  fieldworkEndDate: string | null;
  fieldworkStartDate: string | null;
  hoursByTester: HoursByTester[];
  hoursEntryRows: HoursEntryRow[];
  lastSyncedAt: string;
  mode: DashboardMode;
  phaseBudgets: BudgetByPhase[];
  planningEndDate: string | null;
  planningStartDate: string | null;
  reportingEndDate: string | null;
  reportingStartDate: string | null;
  sourceSummaries: TimeSourceSummary[];
  syncCount: number;
  timeEntries: DemoTimeEntry[];
  totalActual: number;
  totalPlanned: number;
  variance: number;
};

type AuditTimeEntryRow = {
  control_id: string | null;
  created_at: string;
  entry_date: string;
  hours: number;
  id: string;
  phase: string;
  source: string;
  updated_at: string;
  user_id: string;
  work_item_reference: string | null;
};

export async function getHoursBudgetViewModel({
  auditId,
  auditLabel,
  mode,
  phaseOverride,
  syncCount,
}: {
  auditId?: string;
  auditLabel?: string;
  mode: DashboardMode;
  phaseOverride?: AuditPhase;
  syncCount?: string | number;
}): Promise<HoursBudgetViewModel> {
  const normalizedSyncCount = getNormalizedSyncCount(syncCount);

  if (mode === "live" && auditId) {
    return getLiveHoursBudgetViewModel({ auditId, auditLabel, phaseOverride, syncCount: normalizedSyncCount });
  }

  const phaseBudgets = getPrototypePhaseBudgets();
  const currentPhase = phaseOverride ?? "Planning";
  const syncedHours = getSyncedHoursData({
    activePhase: currentPhase,
    budgetByPhase: phaseBudgets,
    controls,
    syncCount: normalizedSyncCount,
  });
  const currentPhaseBudget = getCurrentPhaseBudget(syncedHours.budgetByPhase, currentPhase);

  return {
    auditId: null,
    auditLabel: "Prototype Demo Audit",
    totalBudgetHours: sumPhasePlannedHours(phaseBudgets),
    auditPeriodEnd: "2026-05-12T17:00:00.000Z",
    auditPeriodLabel: "Static sample data",
    auditPeriodStart: "2026-04-15T17:00:00.000Z",
    controls: syncedHours.controls,
    currentPhase,
    currentPhaseVariance: currentPhaseBudget.actualHours - currentPhaseBudget.plannedHours,
    fieldworkEndDate: "2026-05-02T17:00:00.000Z",
    fieldworkStartDate: "2026-04-21T17:00:00.000Z",
    hoursByTester: getHoursByTester(users, syncedHours.controls),
    hoursEntryRows: getHoursEntryRows(users, syncedHours.timeEntries, syncedHours.controls),
    lastSyncedAt: syncedHours.lastSyncedAt,
    mode: "prototype",
    phaseBudgets: syncedHours.budgetByPhase,
    planningEndDate: "2026-04-20T17:00:00.000Z",
    planningStartDate: "2026-04-15T17:00:00.000Z",
    reportingEndDate: "2026-05-12T17:00:00.000Z",
    reportingStartDate: "2026-05-03T17:00:00.000Z",
    sourceSummaries: syncedHours.sourceSummaries,
    syncCount: syncedHours.syncCount,
    timeEntries: syncedHours.timeEntries,
    totalActual: sumPhaseActualHours(syncedHours.budgetByPhase),
    totalPlanned: sumPhasePlannedHours(syncedHours.budgetByPhase),
    variance: currentPhaseBudget.actualHours - currentPhaseBudget.plannedHours,
  };
}

async function getLiveHoursBudgetViewModel({
  auditId,
  auditLabel,
  phaseOverride,
  syncCount,
}: {
  auditId: string;
  auditLabel?: string;
  phaseOverride?: AuditPhase;
  syncCount: number;
}) {
  const supabase = createSupabaseAdminClient();
  const [auditResult, controlsResult, usersResult, businessUnitsResult, timeEntriesResult] = await Promise.all([
    getLiveAuditBudgetRecord(supabase, auditId),
    supabase
      .from("controls")
      .select("id, source_record_key, control_name, business_unit_id, control_owner_user_id, assigned_owner_user_id, status, due_date, assigned_due_date, planned_hours, assigned_planned_hours, actual_hours, risk_rating, planning_overridden_at, source_payload")
      .eq("audit_id", auditId)
      .returns<ControlRow[]>(),
    supabase.from("users").select("id, full_name, email, role, team").order("full_name", { ascending: true }).returns<UserRow[]>(),
    supabase.from("business_units").select("id, name").returns<BusinessUnitRow[]>(),
    selectAuditTimeEntries(supabase, auditId),
  ]);

  const businessUnitMap = new Map((businessUnitsResult.data ?? []).map((unit) => [unit.id, unit.name]));
  const liveUsers = (usersResult.data ?? []).map(mapUser);
  const liveControls = (controlsResult.data ?? []).map((control) => mapControl(control, businessUnitMap));
  const currentPhase = phaseOverride ?? normalizeAuditPhase(auditResult.data?.active_phase);
  const phaseBudgetPlan = buildLivePhaseBudgetPlan({
    planning_budget_hours: auditResult.data?.planning_budget_hours ?? null,
    fieldwork_budget_hours: auditResult.data?.fieldwork_budget_hours ?? null,
    reporting_budget_hours: auditResult.data?.reporting_budget_hours ?? null,
  });
  const fallbackSyncedHours = getSyncedHoursData({
    activePhase: currentPhase,
    budgetByPhase: phaseBudgetPlan,
    controls: liveControls,
    syncCount,
    syncReferenceTime: new Date().toISOString(),
  });
  const mappedTimeEntries = mapAuditTimeEntries(timeEntriesResult.data ?? []);
  const hasImportedTimeEntries = mappedTimeEntries.length > 0;
  const actualHoursByPhase = hasImportedTimeEntries
    ? sumActualHoursByPhase(mappedTimeEntries)
    : new Map(fallbackSyncedHours.budgetByPhase.map((phaseBudget) => [phaseBudget.phase, phaseBudget.actualHours] as const));
  const phaseBudgets = phaseBudgetPlan.map((phaseBudget) => ({
    ...phaseBudget,
    actualHours: actualHoursByPhase.get(phaseBudget.phase) ?? 0,
  }));
  const currentPhaseBudget = getCurrentPhaseBudget(phaseBudgets, currentPhase);
  const totalActual = phaseBudgets.reduce((sum, phaseBudget) => sum + phaseBudget.actualHours, 0);

  return {
    auditId,
    auditLabel: auditResult.data?.name ?? auditLabel ?? "Live audit workspace",
    totalBudgetHours:
      auditResult.data?.total_budget_hours === null || auditResult.data?.total_budget_hours === undefined
        ? null
        : Number(auditResult.data.total_budget_hours),
    auditPeriodEnd: auditResult.data?.period_end ?? null,
    auditPeriodLabel:
      auditResult.data?.period_start && auditResult.data?.period_end
        ? formatAuditScopePeriod(auditResult.data)
        : "Saved audit",
    auditPeriodStart: auditResult.data?.period_start ?? null,
    controls: fallbackSyncedHours.controls,
    currentPhase,
    currentPhaseVariance: currentPhaseBudget.actualHours - currentPhaseBudget.plannedHours,
    fieldworkEndDate: auditResult.data?.fieldwork_end_date ?? null,
    fieldworkStartDate: auditResult.data?.fieldwork_start_date ?? null,
    hoursByTester: hasImportedTimeEntries ? getHoursByTesterFromEntries(liveUsers, mappedTimeEntries) : getHoursByTester(liveUsers, fallbackSyncedHours.controls),
    hoursEntryRows: getHoursEntryRows(liveUsers, hasImportedTimeEntries ? mappedTimeEntries : fallbackSyncedHours.timeEntries, fallbackSyncedHours.controls),
    lastSyncedAt: hasImportedTimeEntries ? getLatestAuditTimeEntryTimestamp(timeEntriesResult.data ?? []) : fallbackSyncedHours.lastSyncedAt,
    mode: "live" as const,
    phaseBudgets,
    planningEndDate: auditResult.data?.planning_end_date ?? null,
    planningStartDate: auditResult.data?.planning_start_date ?? null,
    reportingEndDate: auditResult.data?.reporting_end_date ?? null,
    reportingStartDate: auditResult.data?.reporting_start_date ?? null,
    sourceSummaries: hasImportedTimeEntries
      ? [{ source: "Recorded" as const, entryCount: mappedTimeEntries.length, totalHours: totalActual }]
      : fallbackSyncedHours.sourceSummaries,
    syncCount: fallbackSyncedHours.syncCount,
    timeEntries: hasImportedTimeEntries ? mappedTimeEntries : fallbackSyncedHours.timeEntries,
    totalActual,
    totalPlanned: sumPhasePlannedHours(phaseBudgets),
    variance: currentPhaseBudget.actualHours - currentPhaseBudget.plannedHours,
  };
}

async function getLiveAuditBudgetRecord(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  auditId: string,
) {
  try {
    return await supabase
      .from("audits")
      .select("id, name, period_start, period_end, scope_period_start, scope_period_end, total_budget_hours, planning_start_date, planning_end_date, fieldwork_start_date, fieldwork_end_date, reporting_start_date, reporting_end_date, active_phase, planning_budget_hours, fieldwork_budget_hours, reporting_budget_hours")
      .eq("id", auditId)
      .maybeSingle<
        Pick<AuditRecord, "id" | "name" | "period_start" | "period_end" | "scope_period_start" | "scope_period_end" | "total_budget_hours"> & {
          active_phase: string | null;
          fieldwork_end_date: string | null;
          fieldwork_start_date: string | null;
          planning_budget_hours: number | null;
          planning_end_date: string | null;
          planning_start_date: string | null;
          fieldwork_budget_hours: number | null;
          reporting_budget_hours: number | null;
          reporting_end_date: string | null;
          reporting_start_date: string | null;
        }
      >();
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }

    if (error.message.includes("scope_period_start")) {
      const fallbackWithBudget = await supabase
        .from("audits")
        .select("id, name, period_start, period_end, total_budget_hours, planning_start_date, planning_end_date, fieldwork_start_date, fieldwork_end_date, reporting_start_date, reporting_end_date, active_phase, planning_budget_hours, fieldwork_budget_hours, reporting_budget_hours")
        .eq("id", auditId)
        .maybeSingle<
          Pick<AuditRecord, "id" | "name" | "period_start" | "period_end" | "total_budget_hours"> & {
            active_phase: string | null;
            fieldwork_end_date: string | null;
            fieldwork_start_date: string | null;
            planning_budget_hours: number | null;
            planning_end_date: string | null;
            planning_start_date: string | null;
            fieldwork_budget_hours: number | null;
            reporting_budget_hours: number | null;
            reporting_end_date: string | null;
            reporting_start_date: string | null;
          }
        >();

      return {
        ...fallbackWithBudget,
        data: fallbackWithBudget.data
          ? {
              ...fallbackWithBudget.data,
              scope_period_start: fallbackWithBudget.data.period_start,
              scope_period_end: fallbackWithBudget.data.period_end,
            }
          : null,
      };
    }

    if (!error.message.includes("total_budget_hours")) {
      throw error;
    }

    const fallbackResult = await supabase
      .from("audits")
      .select("id, name, period_start, period_end, planning_start_date, planning_end_date, fieldwork_start_date, fieldwork_end_date, reporting_start_date, reporting_end_date, active_phase, planning_budget_hours, fieldwork_budget_hours, reporting_budget_hours")
      .eq("id", auditId)
      .maybeSingle<
        Pick<AuditRecord, "id" | "name" | "period_start" | "period_end"> & {
          active_phase: string | null;
          fieldwork_end_date: string | null;
          fieldwork_start_date: string | null;
          planning_budget_hours: number | null;
          planning_end_date: string | null;
          planning_start_date: string | null;
          fieldwork_budget_hours: number | null;
          reporting_budget_hours: number | null;
          reporting_end_date: string | null;
          reporting_start_date: string | null;
        }
      >();

    return {
      ...fallbackResult,
      data: fallbackResult.data
        ? {
            ...fallbackResult.data,
            total_budget_hours: null,
            scope_period_start: fallbackResult.data.period_start,
            scope_period_end: fallbackResult.data.period_end,
          }
        : null,
    };
  }
}

async function selectAuditTimeEntries(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  auditId: string,
) {
  try {
    return await supabase
      .from("audit_time_entries")
      .select("id, control_id, user_id, phase, source, hours, entry_date, work_item_reference, created_at, updated_at")
      .eq("audit_id", auditId)
      .order("entry_date", { ascending: true })
      .returns<AuditTimeEntryRow[]>();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("audit_time_entries")) {
      throw error;
    }

    return {
      data: [] as AuditTimeEntryRow[],
      error: null,
    };
  }
}

function getHoursByTester(userPool: User[], controls: Control[]) {
  const actualHoursByUser = controls.reduce<Map<string, number>>((totals, control) => {
    const userId = control.assignedOwnerId ?? control.ownerId;

    if (!userId) {
      return totals;
    }

    totals.set(userId, (totals.get(userId) ?? 0) + control.actualHours);
    return totals;
  }, new Map());

  return userPool
    .map((user) => ({
      actualHours: actualHoursByUser.get(user.id) ?? 0,
      id: user.id,
      name: user.name,
      role: user.role,
    }))
    .filter((tester) => tester.actualHours > 0)
    .sort((left, right) => right.actualHours - left.actualHours);
}

function getHoursByTesterFromEntries(userPool: User[], timeEntries: DemoTimeEntry[]) {
  const actualHoursByUser = timeEntries.reduce<Map<string, number>>((totals, entry) => {
    totals.set(entry.userId, roundToQuarter((totals.get(entry.userId) ?? 0) + entry.hours));
    return totals;
  }, new Map());

  return userPool
    .map((user) => ({
      actualHours: actualHoursByUser.get(user.id) ?? 0,
      id: user.id,
      name: user.name,
      role: user.role,
    }))
    .filter((tester) => tester.actualHours > 0)
    .sort((left, right) => right.actualHours - left.actualHours);
}

function getHoursEntryRows(userPool: User[], timeEntries: DemoTimeEntry[], controls: Control[]) {
  const userMap = new Map(userPool.map((user) => [user.id, user]));
  const controlMap = new Map(controls.map((control) => [control.id, control]));

  return timeEntries
    .map<HoursEntryRow | null>((entry) => {
      const owner = userMap.get(entry.userId);

      if (!owner) {
        return null;
      }

      const linkedControl = entry.controlId ? controlMap.get(entry.controlId) : undefined;
      const controlLabel = linkedControl ? `${linkedControl.referenceId ?? linkedControl.id}` : null;
      const fallbackWorkItem = linkedControl ? `${controlLabel} - ${linkedControl.name}` : "Imported audit hours";

      return {
        controlLabel,
        entryDate: entry.entryDate,
        hours: entry.hours,
        id: entry.id,
        ownerName: owner.name,
        ownerRole: owner.role,
        phase: entry.phase,
        workItemLabel: entry.workItemReference?.trim().length ? entry.workItemReference : fallbackWorkItem,
      };
    })
    .filter((entry): entry is HoursEntryRow => entry !== null)
    .sort((left, right) => {
      const dateDiff = new Date(right.entryDate).getTime() - new Date(left.entryDate).getTime();
      if (dateDiff !== 0) {
        return dateDiff;
      }

      return left.ownerName.localeCompare(right.ownerName) || left.workItemLabel.localeCompare(right.workItemLabel);
    });
}

function mapAuditTimeEntries(rows: AuditTimeEntryRow[]) {
  return rows
    .map<DemoTimeEntry | null>((row) => {
      const phase = normalizePhaseValue(row.phase);

      if (!phase) {
        return null;
      }

      return {
        id: row.id,
        controlId: row.control_id ?? "",
        entryDate: row.entry_date.includes("T") ? row.entry_date : `${row.entry_date}T00:00:00.000Z`,
        hours: roundToQuarter(Number(row.hours ?? 0)),
        phase: "Planning",
        source: "Recorded",
        userId: row.user_id,
        workItemReference: row.work_item_reference ?? "Imported audit hours",
      };
    })
    .filter((entry): entry is DemoTimeEntry => entry !== null);
}

function normalizePhaseValue(value: string) {
  if (value === "Planning" || value === "Fieldwork" || value === "Reporting") {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "planning") {
    return "Planning" as const;
  }

  if (normalized === "fieldwork") {
    return "Fieldwork" as const;
  }

  if (normalized === "reporting") {
    return "Reporting" as const;
  }

  return null;
}

function sumActualHoursByPhase(timeEntries: DemoTimeEntry[]) {
  const totals = new Map<AuditPhase, number>([
    ["Planning", 0],
    ["Fieldwork", 0],
    ["Reporting", 0],
  ]);

  for (const entry of timeEntries) {
    totals.set("Planning", roundToQuarter((totals.get("Planning") ?? 0) + entry.hours));
  }

  return totals;
}

function getLatestAuditTimeEntryTimestamp(rows: AuditTimeEntryRow[]) {
  const latest = rows.reduce((max, row) => {
    const candidate = row.updated_at || row.created_at;
    return candidate > max ? candidate : max;
  }, "");

  return latest || new Date().toISOString();
}

function roundToQuarter(value: number) {
  return Math.round(value * 4) / 4;
}

export { getControlVariance };
