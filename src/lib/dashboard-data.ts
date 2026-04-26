import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDashboardKpis, getExecutiveNarrative, getRiskRows, normalizeAuditPhaseFromAudit } from "@/lib/audit-logic";
import { controls, documents, milestones, mockNow, questions, requests, users } from "@/lib/data/mock-data";
import { formatSourceSummary, getNormalizedSyncCount, getSyncedHoursData } from "@/lib/demo-time-sync";
import { buildLivePhaseBudgetPlan, getPrototypePhaseBudgets } from "@/lib/phase-budget";
import {
  type AuditDocumentRow,
  type AuditRecord,
  type BusinessUnitRow,
  type ControlRow,
  type DashboardMode,
  type QuestionRow,
  type RequestRow,
  type UserRow,
  formatAuditPeriod,
  formatAuditScopePeriod,
  mapControl,
  mapDocument,
  mapQuestionsWithDisplayIds,
  mapRequestsWithDisplayIds,
  mapUser,
} from "@/lib/live-audit";
import type { AuditPhase, BudgetByPhase, KPIProps, RiskRow, TimelineItem, TimeSourceSummary } from "@/types/audit";

export type DashboardViewModel = {
  auditId: string | null;
  auditLabel: string;
  auditStatus: string;
  auditPeriodLabel: string;
  executiveNarrative: string;
  hoursChartData: BudgetByPhase[];
  hoursChartMessage?: string;
  hoursChartInsight: string;
  kpis: KPIProps[];
  milestoneItems: TimelineItem[];
  milestoneMessage?: string;
  milestoneSetupComplete: boolean;
  milestoneSetupHref?: string;
  mode: DashboardMode;
  phase: AuditPhase;
  lastSyncedAt: string;
  riskRows: RiskRow[];
  sourceSummaries: TimeSourceSummary[];
  syncCount: number;
};

export { formatAuditPeriod };

export async function getDashboardViewModel({
  auditId,
  auditLabel,
  phaseOverride,
  mode,
  syncCount,
}: {
  auditId?: string;
  auditLabel?: string;
  phaseOverride?: AuditPhase;
  mode: DashboardMode;
  syncCount?: string | number;
}): Promise<DashboardViewModel> {
  if (mode === "live" && auditId) {
    return getLiveDashboardViewModel({ auditId, auditLabel, phaseOverride, syncCount: getNormalizedSyncCount(syncCount) });
  }

  return getPrototypeDashboardViewModel(phaseOverride, getNormalizedSyncCount(syncCount));
}

function getPrototypeDashboardViewModel(phaseOverride?: AuditPhase, syncCount = 0): DashboardViewModel {
  const phase = phaseOverride ?? "Planning";
  const phaseBudgets = getPrototypePhaseBudgets();
  const syncedHours = getSyncedHoursData({
    activePhase: phase,
    budgetByPhase: phaseBudgets,
    controls,
    syncCount,
    syncReferenceTime: mockNow,
  });
  const context = {
    budgetByPhase: syncedHours.budgetByPhase,
    controls: syncedHours.controls,
    documents,
    milestones,
    now: mockNow,
    questions,
    requests,
    users,
  };
  const riskRows = getRiskRows(phase, context);

  return {
    auditId: null,
    auditLabel: "Prototype Demo Audit",
    auditPeriodLabel: "Static sample data",
    auditStatus: "Prototype mode",
    executiveNarrative: getExecutiveNarrative(phase, context),
    hoursChartData: syncedHours.budgetByPhase,
    hoursChartInsight:
      phase === "Planning"
        ? "Budgeted hours are managed in the platform while actual hours reflect the recorded control-level totals saved for this audit."
        : phase === "Reporting"
          ? "Reporting actuals reflect the current recorded totals, but the main story is closeout readiness rather than raw throughput."
          : "Fieldwork actuals reflect the current recorded totals saved on the audit controls.",
    kpis: getDashboardKpis(phase, context),
    lastSyncedAt: syncedHours.lastSyncedAt,
    milestoneItems: milestones,
    milestoneMessage: undefined,
    milestoneSetupComplete: true,
    milestoneSetupHref: undefined,
    phase,
    hoursChartMessage: `Actuals source: ${formatSourceSummary(syncedHours.sourceSummaries)} · Last refreshed ${new Date(syncedHours.lastSyncedAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })}`,
    mode: "prototype",
    riskRows,
    sourceSummaries: syncedHours.sourceSummaries,
    syncCount: syncedHours.syncCount,
  };
}

async function getLiveDashboardViewModel({
  auditId,
  auditLabel,
  phaseOverride,
  syncCount,
}: {
  auditId: string;
  auditLabel?: string;
  phaseOverride?: AuditPhase;
  syncCount: number;
}): Promise<DashboardViewModel> {
  const supabase = createSupabaseAdminClient();
  const [
    auditResult,
    controlsResult,
    questionsResult,
    requestsResult,
    documentsResult,
    usersResult,
    businessUnitsResult,
  ] = await Promise.all([
    getLiveDashboardAuditRecord(supabase, auditId),
    supabase
      .from("controls")
      .select("id, source_record_key, control_name, business_unit_id, control_owner_user_id, assigned_owner_user_id, status, due_date, assigned_due_date, planned_hours, assigned_planned_hours, actual_hours, risk_rating, planning_overridden_at, source_payload")
      .eq("audit_id", auditId)
      .returns<ControlRow[]>(),
    supabase
      .from("questions")
      .select("id, control_id, asked_by_user_id, assigned_to, phase_tag, parent_question_id, parent_request_id, created_at, date_sent, due_date, status, question_text, response_text, response_date")
      .eq("audit_id", auditId)
      .returns<QuestionRow[]>(),
    supabase
      .from("requests")
      .select("id, control_id, phase_tag, parent_question_id, parent_request_id, created_at, completed_at, description, requested_from, date_requested, due_date, status, response_notes")
      .eq("audit_id", auditId)
      .returns<RequestRow[]>(),
    supabase
      .from("audit_documents")
      .select("id, document_type, title, control_id, question_id, request_id, owner_user_id, status, due_date, template_name")
      .eq("audit_id", auditId)
      .returns<AuditDocumentRow[]>(),
    supabase.from("users").select("id, full_name, email, role, team").returns<UserRow[]>(),
    supabase.from("business_units").select("id, name").returns<BusinessUnitRow[]>(),
  ]);

  const audit = auditResult.data;
  const userMap = new Map((usersResult.data ?? []).map((user) => [user.id, mapUser(user)]));
  const businessUnitMap = new Map((businessUnitsResult.data ?? []).map((unit) => [unit.id, unit.name]));

  const liveUsers = Array.from(userMap.values());
  const liveControls = (controlsResult.data ?? []).map((control) => mapControl(control, businessUnitMap));
  const liveQuestions = mapQuestionsWithDisplayIds(questionsResult.data ?? [], userMap);
  const liveRequests = mapRequestsWithDisplayIds(requestsResult.data ?? []);
  const liveDocuments = (documentsResult.data ?? []).map(mapDocument);
  const now = new Date().toISOString();
  const phase = phaseOverride ?? normalizeAuditPhaseFromAudit(audit ?? {});
  const phaseBudgets = buildLivePhaseBudgetPlan({
    planning_budget_hours: audit?.planning_budget_hours ?? null,
    fieldwork_budget_hours: audit?.fieldwork_budget_hours ?? null,
    reporting_budget_hours: audit?.reporting_budget_hours ?? null,
  });
  const syncedHours = getSyncedHoursData({
    activePhase: phase,
    budgetByPhase: phaseBudgets,
    controls: liveControls,
    syncCount,
    syncReferenceTime: now,
  });
  const hoursChartData = syncedHours.budgetByPhase;
  const milestoneItems = milestones;
  const milestoneSetupHref = buildHoursBudgetHref({
    auditId,
    auditLabel: audit?.name ?? auditLabel ?? "Live audit workspace",
    mode: "live",
  });
  const derivedMilestones = buildAuditLifecycleMilestones({
    fieldworkEndDate: audit?.fieldwork_end_date ?? null,
    fieldworkStartDate: audit?.fieldwork_start_date ?? null,
    phase,
    planningEndDate: audit?.planning_end_date ?? null,
    planningStartDate: audit?.planning_start_date ?? null,
    reportingEndDate: audit?.reporting_end_date ?? null,
    reportingStartDate: audit?.reporting_start_date ?? null,
    now,
  });
  const context = {
    budgetByPhase: hoursChartData,
    controls: syncedHours.controls,
    documents: liveDocuments,
    milestones: milestoneItems,
    now,
    questions: liveQuestions,
    requests: liveRequests,
    users: liveUsers,
  };

  return {
    auditId,
    auditLabel: audit?.name ?? auditLabel ?? "Live audit workspace",
    auditPeriodLabel: audit ? formatAuditScopePeriod(audit) : "Saved audit",
    auditStatus: audit?.status ?? "Live mode",
    executiveNarrative: getExecutiveNarrative(phase, context),
    hoursChartData,
    hoursChartInsight:
      phase === "Planning"
        ? "Budgeted hours remain audit-managed while actuals reflect the saved control-level totals."
        : "Actual hours reflect the current saved totals on the audit controls.",
    hoursChartMessage: `Actuals source: ${formatSourceSummary(syncedHours.sourceSummaries)} · Last refreshed ${new Date(syncedHours.lastSyncedAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })}`,
    kpis: getDashboardKpis(phase, context),
    lastSyncedAt: syncedHours.lastSyncedAt,
    milestoneItems: derivedMilestones.items,
    milestoneMessage: derivedMilestones.message,
    milestoneSetupComplete: derivedMilestones.isConfigured,
    milestoneSetupHref,
    mode: "live",
    phase,
    riskRows: getRiskRows(phase, context),
    sourceSummaries: syncedHours.sourceSummaries,
    syncCount: syncedHours.syncCount,
  };
}

async function getLiveDashboardAuditRecord(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  auditId: string,
) {
  try {
    return await supabase
      .from("audits")
      .select("id, name, status, active_phase, period_start, period_end, scope_period_start, scope_period_end, planning_start_date, planning_end_date, fieldwork_start_date, fieldwork_end_date, reporting_start_date, reporting_end_date, planning_budget_hours, fieldwork_budget_hours, reporting_budget_hours")
      .eq("id", auditId)
      .maybeSingle<
        AuditRecord & {
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
    if (!(error instanceof Error) || !error.message.includes("scope_period_start")) {
      throw error;
    }

    return supabase
      .from("audits")
      .select("id, name, status, active_phase, period_start, period_end, planning_start_date, planning_end_date, fieldwork_start_date, fieldwork_end_date, reporting_start_date, reporting_end_date, planning_budget_hours, fieldwork_budget_hours, reporting_budget_hours")
      .eq("id", auditId)
      .maybeSingle<
        AuditRecord & {
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
  }
}

function buildAuditLifecycleMilestones({
  fieldworkEndDate,
  fieldworkStartDate,
  phase,
  planningEndDate,
  planningStartDate,
  reportingEndDate,
  reportingStartDate,
  now,
}: {
  fieldworkEndDate: string | null;
  fieldworkStartDate: string | null;
  phase: AuditPhase;
  planningEndDate: string | null;
  planningStartDate: string | null;
  reportingEndDate: string | null;
  reportingStartDate: string | null;
  now: string;
}) {
  if (
    !planningStartDate ||
    !planningEndDate ||
    !fieldworkStartDate ||
    !fieldworkEndDate ||
    !reportingStartDate ||
    !reportingEndDate
  ) {
    return {
      isConfigured: false,
      items: [] as TimelineItem[],
      message: "Phase-level lifecycle dates have not been set. Open Hours and budget during planning to configure them.",
    };
  }

  const dates = [
    planningStartDate,
    planningEndDate,
    fieldworkStartDate,
    fieldworkEndDate,
    reportingStartDate,
    reportingEndDate,
  ].map((value) => new Date(value).getTime());

  if (dates.some((value) => Number.isNaN(value))) {
    return {
      isConfigured: false,
      items: [] as TimelineItem[],
      message: "Phase-level lifecycle dates are invalid. Update them from Hours and budget before relying on this timeline.",
    };
  }

  return {
    isConfigured: true,
    items: [
      {
        id: "milestone-planning-start",
        label: "Planning start",
        date: planningStartDate,
        status: getMilestoneStatus(planningStartDate, phase, "Planning", now),
      },
      {
        id: "milestone-fieldwork-start",
        label: "Fieldwork start",
        date: fieldworkStartDate,
        status: getMilestoneStatus(fieldworkStartDate, phase, "Fieldwork", now),
      },
      {
        id: "milestone-reporting-start",
        label: "Reporting start",
        date: reportingStartDate,
        status: getMilestoneStatus(reportingStartDate, phase, "Reporting", now),
      },
      {
        id: "milestone-audit-filed",
        label: "Audit filed",
        date: reportingEndDate,
        status: getMilestoneStatus(reportingEndDate, phase, "Reporting", now),
      },
    ] satisfies TimelineItem[],
    message: "Lifecycle dates are using the saved planning, fieldwork, and reporting date ranges from the audit record.",
  };
}

function getMilestoneStatus(date: string, activePhase: AuditPhase, milestonePhase: AuditPhase, now: string): TimelineItem["status"] {
  const milestoneTime = new Date(date).getTime();
  const nowTime = new Date(now).getTime();

  if (activePhase === "Reporting" && milestonePhase !== "Reporting") {
    return "complete";
  }

  if (activePhase === "Fieldwork" && milestonePhase === "Planning") {
    return "complete";
  }

  if (activePhase === milestonePhase) {
    return milestoneTime < nowTime ? "at_risk" : "active";
  }

  if (milestoneTime < nowTime) {
    return "at_risk";
  }

  return "upcoming";
}

function buildHoursBudgetHref({
  auditId,
  auditLabel,
  mode,
}: {
  auditId: string;
  auditLabel: string;
  mode: DashboardMode;
}) {
  const params = new URLSearchParams({
    auditId,
    auditLabel,
    mode,
  });

  return `/hours-budget?${params.toString()}`;
}
