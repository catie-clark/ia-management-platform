import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { controls, documents, mockNow, questions, requests, users } from "@/lib/data/mock-data";
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
import { normalizeAuditPhase } from "@/lib/audit-phase";
import type { AuditDocument, AuditPhase, Control, Question, Request, User } from "@/types/audit";

export type FieldworkViewModel = {
  auditId: string | null;
  auditLabel: string;
  auditPeriodLabel: string;
  auditStatus: string;
  currentPhase: AuditPhase;
  mode: DashboardMode;
  controls: Control[];
  documents: AuditDocument[];
  questions: Question[];
  requests: Request[];
  users: User[];
  now: string;
};

export async function getFieldworkViewModel({
  auditId,
  auditLabel,
  mode,
}: {
  auditId?: string;
  auditLabel?: string;
  mode: DashboardMode;
}): Promise<FieldworkViewModel> {
  if (mode !== "live" || !auditId) {
    return {
      auditId: null,
      auditLabel: auditLabel ?? "Prototype Demo Audit",
      auditPeriodLabel: "Static sample data",
      auditStatus: "prototype",
      currentPhase: "Fieldwork",
      mode: "prototype",
      controls,
      documents: mapFieldworkDocuments(documents),
      questions,
      requests,
      users,
      now: mockNow,
    };
  }

  return getLiveFieldworkViewModel(auditId, auditLabel);
}

async function getLiveFieldworkViewModel(auditId: string, auditLabel?: string): Promise<FieldworkViewModel> {
  const supabase = createSupabaseAdminClient();
  const [
    auditResult,
    controlsResult,
    documentsResult,
    questionsResult,
    requestsResult,
    usersResult,
    businessUnitsResult,
  ] = await Promise.all([
    getFieldworkAuditRecord(supabase, auditId),
    supabase
      .from("controls")
      .select("id, source_record_key, control_name, business_unit_id, control_owner_user_id, assigned_owner_user_id, status, due_date, assigned_due_date, planned_hours, assigned_planned_hours, actual_hours, risk_rating, planning_overridden_at, source_payload")
      .eq("audit_id", auditId)
      .returns<ControlRow[]>(),
    supabase
      .from("audit_documents")
      .select("id, document_type, title, control_id, question_id, request_id, owner_user_id, status, due_date, template_name, source_payload, created_at, updated_at")
      .eq("audit_id", auditId)
      .in("document_type", ["WORKPAPER", "EVIDENCE"])
      .returns<AuditDocumentRow[]>(),
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
    supabase.from("users").select("id, full_name, email, role, team").order("full_name", { ascending: true }).returns<UserRow[]>(),
    supabase.from("business_units").select("id, name").returns<BusinessUnitRow[]>(),
  ]);

  if (auditResult.error) {
    throw new Error(auditResult.error.message);
  }
  if (controlsResult.error) {
    throw new Error(controlsResult.error.message);
  }
  if (documentsResult.error) {
    throw new Error(documentsResult.error.message);
  }
  if (questionsResult.error) {
    throw new Error(questionsResult.error.message);
  }
  if (requestsResult.error) {
    throw new Error(requestsResult.error.message);
  }
  if (usersResult.error) {
    throw new Error(usersResult.error.message);
  }
  if (businessUnitsResult.error) {
    throw new Error(businessUnitsResult.error.message);
  }

  const userMap = new Map((usersResult.data ?? []).map((user) => [user.id, mapUser(user)]));
  const businessUnitMap = new Map((businessUnitsResult.data ?? []).map((unit) => [unit.id, unit.name]));

  return {
    auditId,
    auditLabel: auditResult.data?.name ?? auditLabel ?? "Live audit workspace",
    auditPeriodLabel:
      auditResult.data?.period_start && auditResult.data?.period_end ? formatAuditScopePeriod(auditResult.data) : "Saved audit",
    auditStatus: auditResult.data?.status ?? "active",
    currentPhase: normalizeAuditPhase(auditResult.data?.active_phase),
    mode: "live",
    controls: (controlsResult.data ?? []).map((control) => mapControl(control, businessUnitMap)),
    documents: mapFieldworkDocuments((documentsResult.data ?? []).map(mapDocument)),
    questions: mapQuestionsWithDisplayIds(questionsResult.data ?? [], userMap),
    requests: mapRequestsWithDisplayIds(requestsResult.data ?? []),
    users: Array.from(userMap.values()),
    now: new Date().toISOString(),
  };
}

async function getFieldworkAuditRecord(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  auditId: string,
) {
  try {
    return await supabase
      .from("audits")
      .select("id, name, period_start, period_end, scope_period_start, scope_period_end, status, active_phase")
      .eq("id", auditId)
      .maybeSingle<Pick<AuditRecord, "id" | "name" | "period_start" | "period_end" | "scope_period_start" | "scope_period_end" | "status" | "active_phase">>();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("scope_period_start")) {
      throw error;
    }

    return supabase
      .from("audits")
      .select("id, name, period_start, period_end, status, active_phase")
      .eq("id", auditId)
      .maybeSingle<Pick<AuditRecord, "id" | "name" | "period_start" | "period_end" | "status" | "active_phase">>();
  }
}

function mapFieldworkDocuments(documentRows: AuditDocument[]) {
  return documentRows
    .filter((document) => document.type === "WORKPAPER" || document.type === "EVIDENCE")
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((document, index) => ({
      ...document,
      displayId: document.displayId ?? `D-${String(index + 1).padStart(2, "0")}`,
    }));
}
