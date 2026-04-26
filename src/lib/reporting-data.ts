import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { controls, documents, mockNow, questions, requests, users } from "@/lib/data/mock-data";
import {
  type AuditDocumentRow,
  type AuditFindingRow,
  type AuditRecord,
  type BusinessUnitRow,
  type ControlRow,
  type DashboardMode,
  type QuestionRow,
  type ReportReviewCommentRow,
  type ReportReviewStageRow,
  type RequestRow,
  type UserRow,
  formatAuditScopePeriod,
  mapControl,
  mapDocument,
  mapFindingsWithDisplayIds,
  mapQuestionsWithDisplayIds,
  mapReportReviewComment,
  mapReportReviewStage,
  mapRequestsWithDisplayIds,
  mapUser,
} from "@/lib/live-audit";
import {
  buildArtifactDraft,
  buildPrototypeFindings,
  buildPrototypeReviewComments,
  buildPrototypeReviewStages,
  createReportDraftMarkdown,
  createReportingTollgateMarkdown,
  defaultReportReviewRoles,
  getArtifactDocument,
  getReportReadinessMessage,
  getResultsSummaryCards,
  reportArtifactConfigs,
} from "@/lib/reporting";
import { normalizeAuditPhase } from "@/lib/audit-phase";
import type {
  AuditDocument,
  AuditFinding,
  AuditPhase,
  Question,
  ReportArtifactKey,
  ReportReviewComment,
  ReportReviewStage,
  Request,
  User,
} from "@/types/audit";

type AuditPhaseRecord = {
  id: string;
  name: string;
  status: string;
  active_phase: string | null;
  period_start: string;
  period_end: string;
};

export type ReportingArtifactDraft = {
  artifactKey: ReportArtifactKey;
  documentId: string | null;
  markdown: string;
  previewSections: Array<{ heading: string; body: string[] }>;
  previewSummary: string;
  status: AuditDocument["status"];
  templateName: string;
  title: string;
  updatedAt?: string;
};

export type ReportingSummaryCard = {
  label: string;
  value: string;
  detail: string;
};

export type ReportingViewModel = {
  auditId: string | null;
  auditLabel: string;
  auditPeriodLabel: string;
  auditStatus: string;
  currentPhase: AuditPhase;
  mode: DashboardMode;
  users: User[];
  controls: ReturnType<typeof mapControl>[];
  findings: AuditFinding[];
  questions: Question[];
  requests: Request[];
  documents: AuditDocument[];
  summaryCards: ReportingSummaryCard[];
  finalReportDraft: ReportingArtifactDraft;
  reportingTollgateDraft: ReportingArtifactDraft;
  reportWorkflow: ReportReviewStage[];
  tollgateWorkflow: ReportReviewStage[];
  reportComments: ReportReviewComment[];
  tollgateComments: ReportReviewComment[];
  reportReadinessMessage: string;
  tollgateReadinessMessage: string;
  reviewRoles: typeof defaultReportReviewRoles;
};

export async function getReportingViewModel({
  auditId,
  auditLabel,
  mode,
}: {
  auditId?: string;
  auditLabel?: string;
  mode: DashboardMode;
}): Promise<ReportingViewModel> {
  if (mode !== "live" || !auditId) {
    return getPrototypeReportingViewModel(auditLabel);
  }

  return getLiveReportingViewModel(auditId, auditLabel);
}

function getPrototypeReportingViewModel(auditLabel?: string): ReportingViewModel {
  const prototypeFindings = buildPrototypeFindings(controls);
  const finalReportDocument = getArtifactDocument(documents, "FINAL_REPORT", "REPORT");
  const reportingTollgateDocument = getArtifactDocument(documents, "REPORTING_TOLLGATE", "TOLLGATE");
  const summaryCards = getResultsSummaryCards({
    controls,
    findings: prototypeFindings,
    now: mockNow,
    questions,
    requests,
    documents,
  });
  const finalReportDraft = createArtifactDraft({
    artifactKey: "FINAL_REPORT",
    auditLabel: auditLabel ?? "Prototype Demo Audit",
    controls,
    currentDocument: finalReportDocument,
    fallbackSummary: "Draft report shell prepared from prototype execution data.",
    findings: prototypeFindings,
    now: mockNow,
    questions,
    requests,
    titleFallback: reportArtifactConfigs.FINAL_REPORT.title,
    users,
  });
  const reportingTollgateDraft = createArtifactDraft({
    artifactKey: "REPORTING_TOLLGATE",
    auditLabel: auditLabel ?? "Prototype Demo Audit",
    controls,
    currentDocument: reportingTollgateDocument,
    fallbackSummary: "Draft reporting tollgate shell prepared from prototype execution data.",
    findings: prototypeFindings,
    now: mockNow,
    questions,
    requests,
    titleFallback: reportArtifactConfigs.REPORTING_TOLLGATE.title,
    users,
  });
  const reportWorkflow = buildPrototypeReviewStages("FINAL_REPORT");
  const tollgateWorkflow = buildPrototypeReviewStages("REPORTING_TOLLGATE");
  const reportComments = buildPrototypeReviewComments();
  const tollgateComments: ReportReviewComment[] = [];

  return {
    auditId: null,
    auditLabel: auditLabel ?? "Prototype Demo Audit",
    auditPeriodLabel: "Static sample data",
    auditStatus: "prototype",
    currentPhase: "Reporting",
    mode: "prototype",
    users,
    controls,
    findings: prototypeFindings,
    questions,
    requests,
    documents,
    summaryCards,
    finalReportDraft,
    reportingTollgateDraft,
    reportWorkflow,
    tollgateWorkflow,
    reportComments,
    tollgateComments,
    reportReadinessMessage: getReportReadinessMessage(reportWorkflow, reportComments.filter((comment) => comment.status !== "RESOLVED")),
    tollgateReadinessMessage: getReportReadinessMessage(tollgateWorkflow, []),
    reviewRoles: defaultReportReviewRoles,
  };
}

async function getLiveReportingViewModel(auditId: string, auditLabel?: string): Promise<ReportingViewModel> {
  const supabase = createSupabaseAdminClient();
  const [
    auditResult,
    controlsResult,
    questionsResult,
    requestsResult,
    documentsResult,
    usersResult,
    businessUnitsResult,
    findingsResult,
    reviewStagesResult,
    reviewCommentsResult,
  ] = await Promise.all([
    getLiveReportingAuditRecord(supabase, auditId),
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
      .select("id, document_type, title, control_id, question_id, request_id, owner_user_id, status, due_date, template_name, source_payload, updated_at")
      .eq("audit_id", auditId)
      .returns<AuditDocumentRow[]>(),
    supabase.from("users").select("id, full_name, email, role, team").returns<UserRow[]>(),
    supabase.from("business_units").select("id, name").returns<BusinessUnitRow[]>(),
    selectAuditFindings(supabase, auditId),
    selectReportReviewStages(supabase, auditId),
    selectReportReviewComments(supabase, auditId),
  ]);

  if (auditResult.error) {
    throw new Error(auditResult.error.message);
  }

  if (controlsResult.error) {
    throw new Error(controlsResult.error.message);
  }

  if (questionsResult.error) {
    throw new Error(questionsResult.error.message);
  }

  if (requestsResult.error) {
    throw new Error(requestsResult.error.message);
  }

  if (documentsResult.error) {
    throw new Error(documentsResult.error.message);
  }

  if (usersResult.error) {
    throw new Error(usersResult.error.message);
  }

  if (businessUnitsResult.error) {
    throw new Error(businessUnitsResult.error.message);
  }

  const audit = auditResult.data;
  const userMap = new Map((usersResult.data ?? []).map((user) => [user.id, mapUser(user)]));
  const businessUnitMap = new Map((businessUnitsResult.data ?? []).map((unit) => [unit.id, unit.name]));
  const liveUsers = Array.from(userMap.values());
  const liveControls = (controlsResult.data ?? []).map((control) => mapControl(control, businessUnitMap));
  const liveQuestions = mapQuestionsWithDisplayIds(questionsResult.data ?? [], userMap);
  const liveRequests = mapRequestsWithDisplayIds(requestsResult.data ?? []);
  const liveDocuments = (documentsResult.data ?? []).map(mapDocument);
  const liveFindings = mapFindingsWithDisplayIds(findingsResult.data ?? []);
  const reviewStages = (reviewStagesResult.data ?? []).map(mapReportReviewStage);
  const reviewComments = (reviewCommentsResult.data ?? []).map(mapReportReviewComment);
  const now = new Date().toISOString();
  const summaryCards = getResultsSummaryCards({
    controls: liveControls,
    findings: liveFindings,
    now,
    questions: liveQuestions,
    requests: liveRequests,
    documents: liveDocuments,
  });
  const finalReportDraft = createArtifactDraft({
    artifactKey: "FINAL_REPORT",
    auditLabel: audit?.name ?? auditLabel ?? "Live audit workspace",
    controls: liveControls,
    currentDocument: getArtifactDocument(liveDocuments, "FINAL_REPORT", "REPORT"),
    fallbackSummary: "Draft final report ready to be generated from live audit data.",
    findings: liveFindings,
    now,
    questions: liveQuestions,
    requests: liveRequests,
    titleFallback: reportArtifactConfigs.FINAL_REPORT.title,
    users: liveUsers,
  });
  const reportingTollgateDraft = createArtifactDraft({
    artifactKey: "REPORTING_TOLLGATE",
    auditLabel: audit?.name ?? auditLabel ?? "Live audit workspace",
    controls: liveControls,
    currentDocument: getArtifactDocument(liveDocuments, "REPORTING_TOLLGATE", "TOLLGATE"),
    fallbackSummary: "Draft reporting tollgate ready to be generated from live audit data.",
    findings: liveFindings,
    now,
    questions: liveQuestions,
    requests: liveRequests,
    titleFallback: reportArtifactConfigs.REPORTING_TOLLGATE.title,
    users: liveUsers,
  });
  const reportWorkflow = ensureWorkflowShape(reviewStages.filter((stage) => stage.artifactKey === "FINAL_REPORT"), "FINAL_REPORT");
  const tollgateWorkflow = ensureWorkflowShape(reviewStages.filter((stage) => stage.artifactKey === "REPORTING_TOLLGATE"), "REPORTING_TOLLGATE");
  const reportComments = reviewComments.filter((comment) => comment.artifactKey === "FINAL_REPORT");
  const tollgateComments = reviewComments.filter((comment) => comment.artifactKey === "REPORTING_TOLLGATE");

  return {
    auditId,
    auditLabel: audit?.name ?? auditLabel ?? "Live audit workspace",
    auditPeriodLabel: audit ? formatAuditScopePeriod(audit) : "Saved audit",
    auditStatus: audit?.status ?? "active",
    currentPhase: normalizeAuditPhase(audit?.active_phase),
    mode: "live",
    users: liveUsers,
    controls: liveControls,
    findings: liveFindings,
    questions: liveQuestions,
    requests: liveRequests,
    documents: liveDocuments,
    summaryCards,
    finalReportDraft,
    reportingTollgateDraft,
    reportWorkflow,
    tollgateWorkflow,
    reportComments,
    tollgateComments,
    reportReadinessMessage: getReportReadinessMessage(reportWorkflow, reportComments.filter((comment) => comment.status !== "RESOLVED")),
    tollgateReadinessMessage: getReportReadinessMessage(tollgateWorkflow, tollgateComments.filter((comment) => comment.status !== "RESOLVED")),
    reviewRoles: defaultReportReviewRoles,
  };
}

async function getLiveReportingAuditRecord(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  auditId: string,
) {
  try {
    return await supabase
      .from("audits")
      .select("id, name, status, active_phase, period_start, period_end, scope_period_start, scope_period_end")
      .eq("id", auditId)
      .maybeSingle<AuditPhaseRecord & Pick<AuditRecord, "scope_period_start" | "scope_period_end">>();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("scope_period_start")) {
      throw error;
    }

    return supabase
      .from("audits")
      .select("id, name, status, active_phase, period_start, period_end")
      .eq("id", auditId)
      .maybeSingle<AuditPhaseRecord>();
  }
}

async function selectAuditFindings(supabase: ReturnType<typeof createSupabaseAdminClient>, auditId: string) {
  try {
    return await supabase
      .from("audit_findings")
      .select("id, audit_id, control_id, title, summary, severity, status, owner_user_id, due_date, impact_statement, recommendation, management_response, created_at, updated_at")
      .eq("audit_id", auditId)
      .returns<AuditFindingRow[]>();
  } catch (error) {
    if (error instanceof Error && error.message.includes("audit_findings")) {
      return { data: [] as AuditFindingRow[], error: null };
    }

    throw error;
  }
}

async function selectReportReviewStages(supabase: ReturnType<typeof createSupabaseAdminClient>, auditId: string) {
  try {
    return await supabase
      .from("report_review_stages")
      .select("id, artifact_key, stage_order, reviewer_role, status, acted_at, acted_by_name, action_comment")
      .eq("audit_id", auditId)
      .order("artifact_key", { ascending: true })
      .order("stage_order", { ascending: true })
      .returns<ReportReviewStageRow[]>();
  } catch (error) {
    if (error instanceof Error && error.message.includes("report_review_stages")) {
      return { data: [] as ReportReviewStageRow[], error: null };
    }

    throw error;
  }
}

async function selectReportReviewComments(supabase: ReturnType<typeof createSupabaseAdminClient>, auditId: string) {
  try {
    return await supabase
      .from("report_review_comments")
      .select("id, artifact_key, review_stage_id, author_role, author_name, comment, status, created_at, resolved_at, resolved_by_name")
      .eq("audit_id", auditId)
      .order("created_at", { ascending: true })
      .returns<ReportReviewCommentRow[]>();
  } catch (error) {
    if (error instanceof Error && error.message.includes("report_review_comments")) {
      return { data: [] as ReportReviewCommentRow[], error: null };
    }

    throw error;
  }
}

function ensureWorkflowShape(stages: ReportReviewStage[], artifactKey: ReportArtifactKey) {
  if (stages.length > 0) {
    return stages;
  }

  return buildPrototypeReviewStages(artifactKey);
}

function createArtifactDraft({
  artifactKey,
  auditLabel,
  controls,
  currentDocument,
  fallbackSummary,
  findings,
  now,
  questions,
  requests,
  titleFallback,
  users,
}: {
  artifactKey: ReportArtifactKey;
  auditLabel: string;
  controls: ReturnType<typeof mapControl>[];
  currentDocument?: AuditDocument;
  fallbackSummary: string;
  findings: AuditFinding[];
  now: string;
  questions: Question[];
  requests: Request[];
  titleFallback: string;
  users: User[];
}): ReportingArtifactDraft {
  const generatedMarkdown =
    artifactKey === "FINAL_REPORT"
      ? createReportDraftMarkdown({ auditLabel, controls, findings, now, questions, requests, users })
      : createReportingTollgateMarkdown({ auditLabel, controls, findings, now, questions, requests, users });
  const savedMarkdown = readGeneratedMarkdown(currentDocument);
  const draft = buildArtifactDraft(savedMarkdown || generatedMarkdown, fallbackSummary);

  return {
    artifactKey,
    documentId: currentDocument?.id ?? null,
    markdown: savedMarkdown || generatedMarkdown,
    previewSections: currentDocument?.previewSections ?? draft.previewSections,
    previewSummary: currentDocument?.previewSummary ?? draft.previewSummary,
    status: currentDocument?.status ?? "NOT_STARTED",
    templateName: currentDocument?.templateName ?? reportArtifactConfigs[artifactKey].templateName,
    title: currentDocument?.title ?? titleFallback,
    updatedAt: currentDocument?.updatedAt,
  };
}

function readGeneratedMarkdown(document?: AuditDocument) {
  if (!document) {
    return "";
  }

  const candidate = document as AuditDocument & { generatedMarkdown?: string };
  return candidate.generatedMarkdown ?? "";
}
