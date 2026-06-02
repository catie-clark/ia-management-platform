import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadAuditControlTestingMatrices } from "@/lib/control-testing-matrix-persistence";
import { loadAuditReviewNotes } from "@/lib/review-notes-persistence";
import { controls, documents, mockNow, questions, requests, users } from "@/lib/data/mock-data";
import {
  type AuditDocumentRow,
  type AuditRecord,
  type BusinessUnitRow,
  type ControlExceptionRow,
  type ControlRow,
  type DashboardMode,
  type QuestionRow,
  type RequestRow,
  type UserRow,
  formatAuditScopePeriod,
  mapControl,
  mapControlException,
  mapDocument,
  mapQuestionsWithDisplayIds,
  mapRequestsWithDisplayIds,
  mapUser,
} from "@/lib/live-audit";
import { normalizeAuditDocuments } from "@/lib/document-normalization";
import { normalizeAuditPhase } from "@/lib/audit-phase";
import type { AuditDocument, AuditPhase, Control, ControlException, ControlTestingMatrix, Question, Request, ReviewNote, User } from "@/types/audit";

type RiskControlLinkRow = {
  control_id: string | null;
  risk_id: string | null;
};

type RiskRow = {
  id: string;
  source_record_key: string | null;
  risk_statement: string;
};

export type FieldworkRiskRow = {
  id: string;
  referenceId: string;
  statement: string;
  associatedControls: Array<{
    id: string;
    referenceId: string;
    name: string;
  }>;
  hasAssociatedControls: boolean;
};

export type FieldworkViewModel = {
  auditId: string | null;
  auditLabel: string;
  auditPeriodLabel: string;
  auditStatus: string;
  currentPhase: AuditPhase;
  fieldworkBudgetHours: number | null;
  mode: DashboardMode;
  controls: Control[];
  controlExceptions: ControlException[];
  testingMatrices: ControlTestingMatrix[];
  documents: AuditDocument[];
  questions: Question[];
  requests: Request[];
  reviewNotes: ReviewNote[];
  risks: FieldworkRiskRow[];
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
  if (!auditId) {
    return {
      auditId: null,
      auditLabel: auditLabel ?? "Live audit workspace",
      auditPeriodLabel: "No audit selected",
      auditStatus: "pending",
      currentPhase: "Fieldwork",
      fieldworkBudgetHours: null,
      mode,
      controls: [],
      controlExceptions: [],
      testingMatrices: [],
      documents: [],
      questions: [],
      requests: [],
      reviewNotes: [],
      risks: [],
      users: [],
      now: new Date().toISOString(),
    };
  }

  return getLiveFieldworkViewModel(auditId, auditLabel);
}

async function getLiveFieldworkViewModel(auditId: string, auditLabel?: string): Promise<FieldworkViewModel> {
  const supabase = createSupabaseAdminClient();
  const [
    auditResult,
    controlsResult,
    controlExceptionsResult,
    riskControlLinksResult,
    risksResult,
    documentsResult,
    questionsResult,
    requestsResult,
    usersResult,
    businessUnitsResult,
    testingMatrices,
    reviewNotes,
  ] = await Promise.all([
    getFieldworkAuditRecord(supabase, auditId),
    supabase
      .from("controls")
      .select("id, source_record_key, control_name, business_unit_id, control_owner_user_id, assigned_owner_user_id, status, due_date, assigned_due_date, planned_hours, assigned_planned_hours, actual_hours, risk_rating, planning_overridden_at, source_payload")
      .eq("audit_id", auditId)
      .returns<ControlRow[]>(),
    supabase
      .from("control_exceptions")
      .select("id, control_id, created_at, created_by_name, created_by_user_id, note")
      .eq("audit_id", auditId)
      .order("created_at", { ascending: true })
      .returns<ControlExceptionRow[]>(),
    supabase
      .from("risk_control_links")
      .select("control_id, risk_id")
      .returns<RiskControlLinkRow[]>(),
    supabase
      .from("risks")
      .select("id, source_record_key, risk_statement")
      .eq("audit_id", auditId)
      .returns<RiskRow[]>(),
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
    loadAuditControlTestingMatrices(supabase, auditId),
    loadAuditReviewNotes(supabase, auditId),
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
  if (controlExceptionsResult.error) {
    throw new Error(controlExceptionsResult.error.message);
  }
  if (riskControlLinksResult.error) {
    throw new Error(riskControlLinksResult.error.message);
  }
  if (risksResult.error) {
    throw new Error(risksResult.error.message);
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
  const liveUsers = Array.from(userMap.values());
  const riskRows = risksResult.data ?? [];
  const riskIds = new Set(riskRows.map((risk) => risk.id));
  const controlRows = controlsResult.data ?? [];
  const controlIds = new Set(controlRows.map((control) => control.id));
  const riskById = new Map(
    riskRows.map((risk) => [
      risk.id,
      { id: risk.source_record_key ?? risk.id, statement: risk.risk_statement },
    ]),
  );
  const relatedRisksByControlId = new Map<string, Array<{ id: string; statement: string }>>();
  const linkedControlIdsByRiskId = new Map<string, string[]>();

  for (const link of riskControlLinksResult.data ?? []) {
    if (!link.control_id || !link.risk_id || !controlIds.has(link.control_id) || !riskIds.has(link.risk_id)) {
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

    const linkedControlIds = linkedControlIdsByRiskId.get(link.risk_id) ?? [];
    if (!linkedControlIds.includes(link.control_id)) {
      linkedControlIds.push(link.control_id);
      linkedControlIdsByRiskId.set(link.risk_id, linkedControlIds);
    }
  }

  const liveControls = controlRows.map((control) => mapControl(control, businessUnitMap, relatedRisksByControlId));
  const controlById = new Map(liveControls.map((control) => [control.id, control]));
  const liveQuestions = mapQuestionsWithDisplayIds(questionsResult.data ?? [], userMap);
  const liveRequests = mapRequestsWithDisplayIds(requestsResult.data ?? []);
  const liveRisks: FieldworkRiskRow[] = riskRows
    .map((risk) => {
      const associatedControls = (linkedControlIdsByRiskId.get(risk.id) ?? [])
        .map((controlId) => controlById.get(controlId))
        .filter((control): control is Control => Boolean(control))
        .map((control) => ({
          id: control.id,
          referenceId: control.referenceId ?? control.id,
          name: control.name,
        }));

      return {
        id: risk.id,
        referenceId: risk.source_record_key ?? risk.id,
        statement: risk.risk_statement,
        associatedControls,
        hasAssociatedControls: associatedControls.length > 0,
      };
    })
    .sort((left, right) => left.referenceId.localeCompare(right.referenceId));

  const normalizedDocuments = mapFieldworkDocuments(
    normalizeAuditDocuments({
      controls: liveControls,
      documents: (documentsResult.data ?? []).map(mapDocument),
      questions: liveQuestions,
      requests: liveRequests,
      users: liveUsers,
    }),
  );

  return {
    auditId,
    auditLabel: auditResult.data?.name ?? auditLabel ?? "Live audit workspace",
    auditPeriodLabel:
      auditResult.data?.period_start && auditResult.data?.period_end ? formatAuditScopePeriod(auditResult.data) : "Saved audit",
    auditStatus: auditResult.data?.status ?? "active",
    currentPhase: normalizeAuditPhase(auditResult.data?.active_phase),
    fieldworkBudgetHours:
      auditResult.data?.fieldwork_budget_hours === null || auditResult.data?.fieldwork_budget_hours === undefined
        ? null
        : Number(auditResult.data.fieldwork_budget_hours),
    mode: "live",
    controls: liveControls,
    controlExceptions: (controlExceptionsResult.data ?? []).map(mapControlException),
    testingMatrices,
    documents: normalizedDocuments,
    questions: liveQuestions,
    requests: liveRequests,
    reviewNotes,
    risks: liveRisks,
    users: liveUsers,
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
      .select("id, name, period_start, period_end, scope_period_start, scope_period_end, status, active_phase, fieldwork_budget_hours")
      .eq("id", auditId)
      .maybeSingle<Pick<AuditRecord, "id" | "name" | "period_start" | "period_end" | "scope_period_start" | "scope_period_end" | "status" | "active_phase" | "fieldwork_budget_hours">>();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("scope_period_start")) {
      throw error;
    }

    return supabase
      .from("audits")
      .select("id, name, period_start, period_end, status, active_phase, fieldwork_budget_hours")
      .eq("id", auditId)
      .maybeSingle<Pick<AuditRecord, "id" | "name" | "period_start" | "period_end" | "status" | "active_phase" | "fieldwork_budget_hours">>();
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
