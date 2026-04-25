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
  mapControl,
  mapDocument,
  mapQuestion,
  mapRequest,
  mapUser,
} from "@/lib/live-audit";
import type { AuditDocument, Control, Question, Request, User } from "@/types/audit";

export type QuestionLogViewModel = {
  auditId: string | null;
  auditLabel: string;
  controls: Control[];
  documents: AuditDocument[];
  mode: DashboardMode;
  questions: Question[];
  requests: Request[];
  users: User[];
};

export async function getQuestionLogViewModel({
  auditId,
  auditLabel,
  mode,
}: {
  auditId?: string;
  auditLabel?: string;
  mode: DashboardMode;
}): Promise<QuestionLogViewModel> {
  if (mode === "live" && auditId) {
    return getLiveQuestionLogViewModel({ auditId, auditLabel });
  }

  return {
    auditId: null,
    auditLabel: "Prototype Demo Audit",
    controls,
    documents,
    mode: "prototype",
    questions,
    requests,
    users,
  };
}

async function getLiveQuestionLogViewModel({
  auditId,
  auditLabel,
}: {
  auditId: string;
  auditLabel?: string;
}): Promise<QuestionLogViewModel> {
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
    supabase.from("audits").select("id, name").eq("id", auditId).maybeSingle<Pick<AuditRecord, "id" | "name">>(),
    supabase
      .from("controls")
      .select("id, source_record_key, control_name, business_unit_id, control_owner_user_id, assigned_owner_user_id, status, due_date, assigned_due_date, planned_hours, assigned_planned_hours, actual_hours, risk_rating, planning_overridden_at, source_payload")
      .eq("audit_id", auditId)
      .returns<ControlRow[]>(),
    supabase
      .from("questions")
      .select("id, control_id, asked_by_user_id, assigned_to, date_sent, due_date, status, question_text, response_text, response_date")
      .eq("audit_id", auditId)
      .returns<QuestionRow[]>(),
    supabase
      .from("requests")
      .select("id, control_id, description, requested_from, date_requested, due_date, status, response_notes")
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

  return {
    auditId,
    auditLabel: auditResult.data?.name ?? auditLabel ?? "Live audit workspace",
    controls: (controlsResult.data ?? []).map((control) => mapControl(control, businessUnitMap)),
    documents: (documentsResult.data ?? []).map(mapDocument),
    mode: "live",
    questions: (questionsResult.data ?? []).map((question) => mapQuestion(question, userMap)),
    requests: (requestsResult.data ?? []).map(mapRequest),
    users: Array.from(userMap.values()),
  };
}

export function getQuestionLogNow(mode: DashboardMode) {
  return mode === "prototype" ? mockNow : new Date().toISOString();
}
