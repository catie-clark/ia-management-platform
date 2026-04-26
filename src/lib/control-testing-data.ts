import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { documents, mockNow, questions, requests, users } from "@/lib/data/mock-data";
import { getNormalizedSyncCount, getSyncedHoursData } from "@/lib/demo-time-sync";
import {
  type AuditDocumentRow,
  type AuditRecord,
  type BusinessUnitRow,
  type ControlRow,
  type DashboardMode,
  type QuestionRow,
  type RequestRow,
  type UserRow,
  formatAuditScopePeriod,
  mapControl,
  mapDocument,
  mapQuestionsWithDisplayIds,
  mapRequestsWithDisplayIds,
  mapUser,
} from "@/lib/live-audit";
import { controls } from "@/lib/data/mock-data";
import type { AuditDocument, Control, Question, Request, User } from "@/types/audit";

type RiskControlLinkRow = {
  control_id: string | null;
  risk_id: string | null;
};

type RiskRow = {
  id: string;
  source_record_key: string | null;
  risk_statement: string;
};

export type ControlTestingViewModel = {
  auditId: string | null;
  auditLabel: string;
  auditPeriodLabel: string;
  controls: Control[];
  documents: AuditDocument[];
  mode: DashboardMode;
  questions: Question[];
  requests: Request[];
  users: User[];
};

export async function getControlTestingViewModel({
  auditId,
  auditLabel,
  mode,
  syncCount,
}: {
  auditId?: string;
  auditLabel?: string;
  mode: DashboardMode;
  syncCount?: string | number;
}): Promise<ControlTestingViewModel> {
  const normalizedSyncCount = getNormalizedSyncCount(syncCount);

  if (mode === "live" && auditId) {
    return getLiveControlTestingViewModel({ auditId, auditLabel, syncCount: normalizedSyncCount });
  }

  const syncedHours = getSyncedHoursData({
    budgetByPhase: [],
    controls,
    syncCount: normalizedSyncCount,
    syncReferenceTime: mockNow,
  });

  return {
    auditId: null,
    auditLabel: "Prototype Demo Audit",
    auditPeriodLabel: "Static sample data",
    controls: syncedHours.controls,
    documents,
    mode: "prototype",
    questions,
    requests,
    users,
  };
}

async function getLiveControlTestingViewModel({
  auditId,
  auditLabel,
  syncCount,
}: {
  auditId: string;
  auditLabel?: string;
  syncCount: number;
}) {
  const supabase = createSupabaseAdminClient();
  const [
    auditResult,
    controlsResult,
    riskControlLinksResult,
    risksResult,
    questionsResult,
    requestsResult,
    documentsResult,
    usersResult,
    businessUnitsResult,
  ] = await Promise.all([
    getControlTestingAuditRecord(supabase, auditId),
    supabase
      .from("controls")
      .select("id, source_record_key, control_name, business_unit_id, control_owner_user_id, assigned_owner_user_id, status, due_date, assigned_due_date, planned_hours, assigned_planned_hours, actual_hours, risk_rating, planning_overridden_at, source_payload")
      .eq("audit_id", auditId)
      .returns<ControlRow[]>(),
    supabase
      .from("risk_control_links")
      .select("control_id, risk_id")
      .returns<RiskControlLinkRow[]>(),
    supabase.from("risks").select("id, source_record_key, risk_statement").eq("audit_id", auditId).returns<RiskRow[]>(),
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
    supabase.from("users").select("id, full_name, email, role, team").order("full_name", { ascending: true }).returns<UserRow[]>(),
    supabase.from("business_units").select("id, name").returns<BusinessUnitRow[]>(),
  ]);

  const userMap = new Map((usersResult.data ?? []).map((user) => [user.id, mapUser(user)]));
  const businessUnitMap = new Map((businessUnitsResult.data ?? []).map((unit) => [unit.id, unit.name]));
  const controlIds = new Set((controlsResult.data ?? []).map((control) => control.id));
  const riskById = new Map(
    (risksResult.data ?? []).map((risk) => [
      risk.id,
      { id: risk.source_record_key ?? risk.id, statement: risk.risk_statement },
    ]),
  );
  const relatedRisksByControlId = new Map<string, Array<{ id: string; statement: string }>>();

  for (const link of riskControlLinksResult.data ?? []) {
    if (!link.control_id || !link.risk_id || !controlIds.has(link.control_id)) {
      continue;
    }

    const risk = riskById.get(link.risk_id);

    if (!risk) {
      continue;
    }

    const existingRisks = relatedRisksByControlId.get(link.control_id) ?? [];

    if (!existingRisks.some((entry) => entry.id === risk.id)) {
      existingRisks.push(risk);
      relatedRisksByControlId.set(link.control_id, existingRisks);
    }
  }

  const liveControls = (controlsResult.data ?? []).map((control) => mapControl(control, businessUnitMap, relatedRisksByControlId));
  const syncedHours = getSyncedHoursData({
    budgetByPhase: [],
    controls: liveControls,
    syncCount,
    syncReferenceTime: new Date().toISOString(),
  });

  return {
    auditId,
    auditLabel: auditResult.data?.name ?? auditLabel ?? "Live audit workspace",
    auditPeriodLabel:
      auditResult.data?.period_start && auditResult.data?.period_end
        ? formatAuditScopePeriod(auditResult.data)
        : "Saved audit",
    controls: syncedHours.controls,
    documents: (documentsResult.data ?? []).map(mapDocument),
    mode: "live" as const,
    questions: mapQuestionsWithDisplayIds(questionsResult.data ?? [], userMap),
    requests: mapRequestsWithDisplayIds(requestsResult.data ?? []),
    users: Array.from(userMap.values()),
  };
}

async function getControlTestingAuditRecord(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  auditId: string,
) {
  try {
    return await supabase
      .from("audits")
      .select("id, name, period_start, period_end, scope_period_start, scope_period_end")
      .eq("id", auditId)
      .maybeSingle<Pick<AuditRecord, "id" | "name" | "period_start" | "period_end" | "scope_period_start" | "scope_period_end">>();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("scope_period_start")) {
      throw error;
    }

    return supabase
      .from("audits")
      .select("id, name, period_start, period_end")
      .eq("id", auditId)
      .maybeSingle<Pick<AuditRecord, "id" | "name" | "period_start" | "period_end">>();
  }
}

export function getControlTestingNow(mode: DashboardMode) {
  return mode === "prototype" ? mockNow : new Date().toISOString();
}
