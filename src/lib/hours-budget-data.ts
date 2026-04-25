import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { controls, users } from "@/lib/data/mock-data";
import { formatAuditPeriod, type AuditRecord, type BusinessUnitRow, type ControlRow, type DashboardMode, type UserRow, mapControl, mapUser } from "@/lib/live-audit";
import { getControlVariance } from "@/lib/audit-logic";
import { getNormalizedSyncCount, getSyncedHoursData } from "@/lib/demo-time-sync";
import { getPrototypePhaseBudgets, buildLivePhaseBudgetPlan, getCurrentPhaseBudget, sumPhaseActualHours, sumPhasePlannedHours } from "@/lib/phase-budget";
import { normalizeAuditPhase } from "@/lib/audit-phase";
import type { BudgetByPhase, Control, DemoTimeEntry, TimeSourceSummary, User } from "@/types/audit";

export type HoursByTester = {
  actualHours: number;
  id: string;
  name: string;
  role: User["role"];
};

export type HoursBudgetViewModel = {
  auditId: string | null;
  auditLabel: string;
  auditPeriodEnd: string | null;
  auditPeriodLabel: string;
  auditPeriodStart: string | null;
  fieldworkEndDate: string | null;
  fieldworkStartDate: string | null;
  planningEndDate: string | null;
  planningStartDate: string | null;
  controls: Control[];
  currentPhase: "Planning" | "Fieldwork" | "Reporting";
  currentPhaseVariance: number;
  hoursByTester: HoursByTester[];
  lastSyncedAt: string;
  mode: DashboardMode;
  phaseBudgets: BudgetByPhase[];
  sourceSummaries: TimeSourceSummary[];
  syncCount: number;
  timeEntries: DemoTimeEntry[];
  totalActual: number;
  totalPlanned: number;
  variance: number;
  reportingEndDate: string | null;
  reportingStartDate: string | null;
};

export async function getHoursBudgetViewModel({
  auditId,
  auditLabel,
  mode,
  syncCount,
}: {
  auditId?: string;
  auditLabel?: string;
  mode: DashboardMode;
  syncCount?: string | number;
}): Promise<HoursBudgetViewModel> {
  const normalizedSyncCount = getNormalizedSyncCount(syncCount);

  if (mode === "live" && auditId) {
    return getLiveHoursBudgetViewModel({ auditId, auditLabel, syncCount: normalizedSyncCount });
  }

  const phaseBudgets = getPrototypePhaseBudgets();
  const currentPhase = "Planning";
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
    auditPeriodEnd: "2026-05-12T17:00:00.000Z",
    auditPeriodLabel: "Static sample data",
    auditPeriodStart: "2026-04-15T17:00:00.000Z",
    fieldworkEndDate: "2026-05-02T17:00:00.000Z",
    fieldworkStartDate: "2026-04-21T17:00:00.000Z",
    planningEndDate: "2026-04-20T17:00:00.000Z",
    planningStartDate: "2026-04-15T17:00:00.000Z",
    controls: syncedHours.controls,
    currentPhase,
    currentPhaseVariance: currentPhaseBudget.actualHours - currentPhaseBudget.plannedHours,
    hoursByTester: getHoursByTester(users, syncedHours.timeEntries),
    lastSyncedAt: syncedHours.lastSyncedAt,
    mode: "prototype",
    phaseBudgets: syncedHours.budgetByPhase,
    sourceSummaries: syncedHours.sourceSummaries,
    syncCount: syncedHours.syncCount,
    timeEntries: syncedHours.timeEntries,
    totalActual: sumPhaseActualHours(syncedHours.budgetByPhase),
    totalPlanned: sumPhasePlannedHours(syncedHours.budgetByPhase),
    variance: currentPhaseBudget.actualHours - currentPhaseBudget.plannedHours,
    reportingEndDate: "2026-05-12T17:00:00.000Z",
    reportingStartDate: "2026-05-03T17:00:00.000Z",
  };
}

async function getLiveHoursBudgetViewModel({
  auditId,
  auditLabel,
  syncCount,
}: {
  auditId: string;
  auditLabel?: string;
  syncCount: number;
}) {
  const supabase = createSupabaseAdminClient();
  const [auditResult, controlsResult, usersResult, businessUnitsResult] = await Promise.all([
    supabase
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
      >(),
    supabase
      .from("controls")
      .select("id, source_record_key, control_name, business_unit_id, control_owner_user_id, assigned_owner_user_id, status, due_date, assigned_due_date, planned_hours, assigned_planned_hours, actual_hours, risk_rating, planning_overridden_at, source_payload")
      .eq("audit_id", auditId)
      .returns<ControlRow[]>(),
    supabase.from("users").select("id, full_name, email, role, team").order("full_name", { ascending: true }).returns<UserRow[]>(),
    supabase.from("business_units").select("id, name").returns<BusinessUnitRow[]>(),
  ]);

  const businessUnitMap = new Map((businessUnitsResult.data ?? []).map((unit) => [unit.id, unit.name]));
  const liveUsers = (usersResult.data ?? []).map(mapUser);
  const liveControls = (controlsResult.data ?? []).map((control) => mapControl(control, businessUnitMap));
  const currentPhase = normalizeAuditPhase(auditResult.data?.active_phase);
  const phaseBudgetPlan = buildLivePhaseBudgetPlan({
    planning_budget_hours: auditResult.data?.planning_budget_hours ?? null,
    fieldwork_budget_hours: auditResult.data?.fieldwork_budget_hours ?? null,
    reporting_budget_hours: auditResult.data?.reporting_budget_hours ?? null,
  });
  const syncedHours = getSyncedHoursData({
    activePhase: currentPhase,
    budgetByPhase: phaseBudgetPlan,
    controls: liveControls,
    syncCount,
    syncReferenceTime: new Date().toISOString(),
  });
  const currentPhaseBudget = getCurrentPhaseBudget(syncedHours.budgetByPhase, currentPhase);

  return {
    auditId,
    auditLabel: auditResult.data?.name ?? auditLabel ?? "Live audit workspace",
    auditPeriodEnd: auditResult.data?.period_end ?? null,
    auditPeriodLabel:
      auditResult.data?.period_start && auditResult.data?.period_end
        ? formatAuditPeriod(auditResult.data.period_start, auditResult.data.period_end)
        : "Saved audit",
    auditPeriodStart: auditResult.data?.period_start ?? null,
    fieldworkEndDate: auditResult.data?.fieldwork_end_date ?? null,
    fieldworkStartDate: auditResult.data?.fieldwork_start_date ?? null,
    planningEndDate: auditResult.data?.planning_end_date ?? null,
    planningStartDate: auditResult.data?.planning_start_date ?? null,
    controls: syncedHours.controls,
    currentPhase,
    currentPhaseVariance: currentPhaseBudget.actualHours - currentPhaseBudget.plannedHours,
    hoursByTester: getHoursByTester(liveUsers, syncedHours.timeEntries),
    lastSyncedAt: syncedHours.lastSyncedAt,
    mode: "live" as const,
    phaseBudgets: syncedHours.budgetByPhase,
    sourceSummaries: syncedHours.sourceSummaries,
    syncCount: syncedHours.syncCount,
    timeEntries: syncedHours.timeEntries,
    totalActual: sumPhaseActualHours(syncedHours.budgetByPhase),
    totalPlanned: sumPhasePlannedHours(syncedHours.budgetByPhase),
    variance: currentPhaseBudget.actualHours - currentPhaseBudget.plannedHours,
    reportingEndDate: auditResult.data?.reporting_end_date ?? null,
    reportingStartDate: auditResult.data?.reporting_start_date ?? null,
  };
}

function getHoursByTester(userPool: User[], timeEntries: DemoTimeEntry[]) {
  const allocationEntries = distributeEntriesAcrossUsers(timeEntries, userPool);
  const actualHoursByUser = allocationEntries.reduce<Map<string, number>>((totals, entry) => {
    totals.set(entry.userId, (totals.get(entry.userId) ?? 0) + entry.hours);
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

function distributeEntriesAcrossUsers(timeEntries: DemoTimeEntry[], userPool: User[]) {
  const activeUsers = userPool;

  if (timeEntries.length === 0 || activeUsers.length <= 1) {
    return timeEntries;
  }

  const uniqueUserIds = new Set(timeEntries.map((entry) => entry.userId).filter((value) => value.length > 0));

  if (uniqueUserIds.size > 1) {
    return timeEntries;
  }

  return timeEntries.map((entry, index) => ({
    ...entry,
    userId: activeUsers[index % Math.min(activeUsers.length, 4)]?.id ?? entry.userId,
  }));
}

export { getControlVariance };
