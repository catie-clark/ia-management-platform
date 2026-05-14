import type {
  AuditDocument,
  ControlException,
  AuditFinding,
  AuditPhase,
  Control,
  ControlScopeStatus,
  ControlTestingMatrix,
  ControlTestingMatrixAttribute,
  ControlTestingMatrixResult,
  ControlTestingMatrixSample,
  Question,
  ReportReviewComment,
  ReportReviewStage,
  Request,
  TestingMatrixAttributeResult,
  User,
} from "@/types/audit";
import { readWorkpaperContent } from "@/lib/workpaper-content";

export type DashboardMode = "live";

export type AuditRecord = {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  scope_period_start?: string;
  scope_period_end?: string;
  total_budget_hours?: number | null;
  planning_start_date?: string | null;
  planning_end_date?: string | null;
  fieldwork_start_date?: string | null;
  fieldwork_end_date?: string | null;
  reporting_start_date?: string | null;
  reporting_end_date?: string | null;
  status: string;
  active_phase?: string | null;
  created_at?: string;
};

export type ControlRow = {
  id: string;
  source_record_key: string | null;
  control_name: string;
  business_unit_id: string | null;
  control_owner_user_id: string | null;
  assigned_owner_user_id: string | null;
  status: string;
  due_date: string | null;
  assigned_due_date: string | null;
  planned_hours: number | null;
  assigned_planned_hours: number | null;
  actual_hours: number | null;
  risk_rating: string;
  planning_overridden_at: string | null;
  scope_status?: string | null;
  source_payload: Record<string, unknown>;
};

export type QuestionRow = {
  id: string;
  control_id: string | null;
  asked_by_user_id: string | null;
  assigned_to: string;
  phase_tag?: string | null;
  parent_question_id?: string | null;
  parent_request_id?: string | null;
  created_at?: string | null;
  date_sent: string | null;
  due_date: string | null;
  status: string;
  question_text: string;
  response_text: string | null;
  response_date: string | null;
};

export type RequestRow = {
  id: string;
  control_id: string | null;
  phase_tag?: string | null;
  parent_question_id?: string | null;
  parent_request_id?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
  description: string;
  requested_from: string;
  date_requested: string | null;
  due_date: string | null;
  status: string;
  response_notes: string | null;
};

export type AuditDocumentRow = {
  id: string;
  document_type: string;
  title: string;
  control_id: string | null;
  question_id: string | null;
  request_id: string | null;
  owner_user_id: string | null;
  status: string;
  due_date: string | null;
  template_name: string | null;
  source_payload?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export type AuditFindingRow = {
  id: string;
  audit_id: string;
  control_id: string | null;
  title: string;
  summary: string;
  severity: string;
  status: string;
  owner_user_id: string | null;
  due_date: string | null;
  impact_statement: string | null;
  recommendation: string | null;
  management_response: string | null;
  created_at: string;
  updated_at: string;
};

export type ReportReviewStageRow = {
  id: string;
  artifact_key: string;
  stage_order: number;
  reviewer_role: string;
  status: string;
  acted_at: string | null;
  acted_by_name: string | null;
  action_comment: string | null;
};

export type ReportReviewCommentRow = {
  id: string;
  artifact_key: string;
  review_stage_id: string | null;
  author_role: string;
  author_name: string;
  comment: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by_name: string | null;
};

export type UserRow = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  team: string | null;
};

export type ControlExceptionRow = {
  id: string;
  control_id: string;
  created_at: string;
  created_by_name: string;
  created_by_user_id: string | null;
  note: string;
};

export type BusinessUnitRow = {
  id: string;
  name: string;
};

export type ControlTestingMatrixRow = {
  id: string;
  audit_id: string;
  control_id: string;
  title: string;
  population_description: string | null;
  population_size: number | null;
  sample_description: string | null;
  sample_size: number | null;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
};

export type ControlTestingMatrixAttributeRow = {
  id: string;
  matrix_id: string;
  attribute_key: string;
  label: string;
  guidance: string | null;
  display_order: number;
};

export type ControlTestingMatrixSampleRow = {
  id: string;
  matrix_id: string;
  sample_identifier: string;
  sample_description: string | null;
  source_reference: string | null;
  exception_noted: string | null;
  display_order: number;
};

export type ControlTestingMatrixResultRow = {
  id: string;
  matrix_id: string;
  sample_id: string;
  attribute_id: string;
  result: string;
};

export function mapUser(user: UserRow): User {
  return {
    id: user.id,
    name: user.full_name,
    email: user.email,
    role: normalizeRole(user.role),
    team: user.team ?? undefined,
  };
}

export function mapControlException(row: ControlExceptionRow): ControlException {
  return {
    id: row.id,
    controlId: row.control_id,
    createdAt: ensureIsoDate(row.created_at),
    createdBy: row.created_by_name,
    createdByUserId: row.created_by_user_id ?? undefined,
    note: row.note,
  };
}

export function mapControlTestingMatrixAttribute(row: ControlTestingMatrixAttributeRow): ControlTestingMatrixAttribute {
  return {
    id: row.id,
    matrixId: row.matrix_id,
    attributeKey: row.attribute_key,
    label: row.label,
    guidance: row.guidance ?? "",
    displayOrder: row.display_order,
  };
}

export function mapControlTestingMatrixSample(row: ControlTestingMatrixSampleRow): ControlTestingMatrixSample {
  return {
    id: row.id,
    matrixId: row.matrix_id,
    sampleIdentifier: row.sample_identifier,
    sampleDescription: row.sample_description ?? "",
    sourceReference: row.source_reference ?? "",
    exceptionNoted: row.exception_noted ?? "",
    displayOrder: row.display_order,
  };
}

export function mapControlTestingMatrixResult(row: ControlTestingMatrixResultRow): ControlTestingMatrixResult {
  return {
    id: row.id,
    matrixId: row.matrix_id,
    sampleId: row.sample_id,
    attributeId: row.attribute_id,
    result: normalizeTestingMatrixAttributeResult(row.result),
  };
}

export function mapControlTestingMatrix(args: {
  attributes: ControlTestingMatrixAttribute[];
  matrix: ControlTestingMatrixRow;
  results: ControlTestingMatrixResult[];
  samples: ControlTestingMatrixSample[];
}): ControlTestingMatrix {
  return {
    id: args.matrix.id,
    auditId: args.matrix.audit_id,
    controlId: args.matrix.control_id,
    title: args.matrix.title,
    populationDescription: args.matrix.population_description ?? "",
    populationSize: args.matrix.population_size ?? undefined,
    sampleDescription: args.matrix.sample_description ?? "",
    sampleSize: args.matrix.sample_size ?? undefined,
    conclusion: args.matrix.conclusion ?? "",
    attributes: args.attributes.slice().sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id)),
    samples: args.samples.slice().sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id)),
    results: args.results,
    createdAt: ensureIsoDate(args.matrix.created_at),
    updatedAt: ensureIsoDate(args.matrix.updated_at),
  };
}

export function mapControl(
  control: ControlRow,
  businessUnitMap: Map<string, string>,
  relatedRisksByControlId?: Map<string, Array<{ id: string; statement: string }>>,
): Control {
  const importedDueDate = toOptionalIsoDate(control.due_date);
  const assignedDueDate = toOptionalIsoDate(control.assigned_due_date);
  const importedPlannedHours = Number(control.planned_hours ?? 0);
  const assignedPlannedHours =
    control.assigned_planned_hours === null || control.assigned_planned_hours === undefined
      ? undefined
      : Number(control.assigned_planned_hours);
  const ownerExplicitlyCleared = readBoolean(control.source_payload, ["assigned_owner_cleared"]);
  const explicitScopeStatus = readText(control.source_payload, ["scope_status", "scopeStatus"]);
  const ownerId = ownerExplicitlyCleared ? "" : control.assigned_owner_user_id ?? control.control_owner_user_id ?? "";
  const hasPlanningOverride =
    ownerExplicitlyCleared ||
    control.assigned_owner_user_id !== null ||
    control.assigned_due_date !== null ||
    control.assigned_planned_hours !== null;
  const payloadRelatedRisks = readTextArray(control.source_payload, [
    "risk_statement",
    "risk_statements",
    "related_risks",
    "linked_risks",
  ]).map((statement, index) => ({
    id: `Risk ${index + 1}`,
    statement,
  }));
  const relatedRisks = relatedRisksByControlId?.get(control.id) ?? payloadRelatedRisks;

  return {
    id: control.id,
    referenceId: control.source_record_key ?? control.id,
    name: control.control_name,
    description: readText(control.source_payload, ["description", "control_description", "summary"]) ?? control.control_name,
    businessUnit: control.business_unit_id ? businessUnitMap.get(control.business_unit_id) ?? "Unknown business unit" : "Unassigned",
    scopeStatus: normalizeControlScopeStatus(explicitScopeStatus),
    hasExplicitScopeAssignment: typeof explicitScopeStatus === "string" && explicitScopeStatus.trim().length > 0,
    ownerId,
    importedOwnerId: control.control_owner_user_id ?? undefined,
    assignedOwnerId: control.assigned_owner_user_id ?? undefined,
    status: normalizeControlStatus(control.status),
    dueDate: assignedDueDate ?? importedDueDate,
    importedDueDate,
    assignedDueDate,
    completedDate: undefined,
    plannedHours: assignedPlannedHours ?? importedPlannedHours,
    importedPlannedHours,
    assignedPlannedHours,
    actualHours: Number(control.actual_hours ?? 0),
    riskLevel: normalizeRiskRating(control.risk_rating),
    relatedRisks: relatedRisks.length > 0 ? relatedRisks : undefined,
    hasPlanningOverride,
    planningOverriddenAt: control.planning_overridden_at ?? undefined,
  };
}

export function mapQuestion(question: QuestionRow, userMap: Map<string, User>): Question {
  return {
    id: question.id,
    controlId: question.control_id ?? "",
    phaseTag: normalizeAuditPhaseTag(question.phase_tag),
    parentQuestionId: question.parent_question_id ?? undefined,
    parentRequestId: question.parent_request_id ?? undefined,
    askedBy: question.asked_by_user_id ? userMap.get(question.asked_by_user_id)?.name ?? "Unknown auditor" : "Unknown auditor",
    assignedTo: question.assigned_to,
    dateSent: ensureIsoDate(question.date_sent),
    dueDate: ensureIsoDate(question.due_date),
    status: normalizeQuestionStatus(question.status),
    questionText: question.question_text,
    responseText: question.response_text ?? undefined,
    responseDate: question.response_date ? ensureIsoDate(question.response_date) : undefined,
  };
}

export function mapRequest(request: RequestRow): Request {
  return {
    id: request.id,
    controlId: request.control_id ?? undefined,
    phaseTag: normalizeAuditPhaseTag(request.phase_tag),
    parentQuestionId: request.parent_question_id ?? undefined,
    parentRequestId: request.parent_request_id ?? undefined,
    description: request.description,
    assignedTo: request.requested_from,
    dateRequested: ensureIsoDate(request.date_requested),
    dueDate: ensureIsoDate(request.due_date),
    status: normalizeRequestStatus(request.status),
    completedAt: request.completed_at ? ensureIsoDate(request.completed_at) : undefined,
    responseNotes: request.response_notes ?? undefined,
  };
}

export function mapQuestionsWithDisplayIds(questionRows: QuestionRow[], userMap: Map<string, User>) {
  return questionRows
    .slice()
    .sort(compareCreatedRecords)
    .map((question, index) => ({
      ...mapQuestion(question, userMap),
      displayId: formatDisplayId("Q", index),
    }));
}

export function mapRequestsWithDisplayIds(requestRows: RequestRow[]) {
  return requestRows
    .slice()
    .sort(compareCreatedRecords)
    .map((request, index) => ({
      ...mapRequest(request),
      displayId: formatDisplayId("R", index),
    }));
}

export function mapDocument(document: AuditDocumentRow): AuditDocument {
  const payload = document.source_payload ?? {};
  const previewSections = readPreviewSections(payload);
  return {
    id: document.id,
    type: normalizeDocumentType(document.document_type),
    artifactKey: normalizeArtifactKey(readText(payload, ["artifact_key"])),
    title: document.title,
    linkedControlId: document.control_id ?? undefined,
    linkedQuestionId: document.question_id ?? undefined,
    linkedRequestId: document.request_id ?? undefined,
    ownerId: document.owner_user_id ?? "",
    status: normalizeDocumentStatus(document.status),
    reviewStatus: normalizeDocumentReviewStatus(readText(payload, ["review_status"])),
    dueDate: document.due_date ? ensureIsoDate(document.due_date) : undefined,
    templateName: document.template_name ?? undefined,
    reviewComment: readText(payload, ["review_comment"]) ?? undefined,
    reviewCommentAuthor: readText(payload, ["review_comment_author"]) ?? undefined,
    reviewCommentDate: readDateText(payload, ["review_comment_date"]),
    generatedMarkdown: readText(payload, ["generated_markdown"]) ?? undefined,
    previewSummary: readText(payload, ["preview_summary"]) ?? undefined,
    previewSections,
    workpaperContent: normalizeDocumentType(document.document_type) === "WORKPAPER" ? readWorkpaperContent(payload, previewSections) : undefined,
    updatedAt: document.updated_at ? ensureIsoDate(document.updated_at) : undefined,
  };
}

export function mapAuditFinding(row: AuditFindingRow): AuditFinding {
  return {
    id: row.id,
    auditId: row.audit_id,
    linkedControlId: row.control_id ?? undefined,
    title: row.title,
    summary: row.summary,
    severity: normalizeRiskRating(row.severity),
    status: normalizeFindingStatus(row.status),
    ownerId: row.owner_user_id ?? undefined,
    dueDate: row.due_date ? ensureIsoDate(row.due_date) : undefined,
    impactStatement: row.impact_statement ?? undefined,
    recommendation: row.recommendation ?? undefined,
    managementResponse: row.management_response ?? undefined,
    createdAt: ensureIsoDate(row.created_at),
    updatedAt: ensureIsoDate(row.updated_at),
  };
}

export function mapFindingsWithDisplayIds(rows: AuditFindingRow[]) {
  return rows
    .slice()
    .sort((left, right) => getRecordTime(left) - getRecordTime(right) || left.id.localeCompare(right.id))
    .map((finding, index) => ({
      ...mapAuditFinding(finding),
      displayId: formatDisplayId("F", index),
    }));
}

export function mapReportReviewStage(row: ReportReviewStageRow): ReportReviewStage {
  return {
    id: row.id,
    artifactKey: normalizeArtifactKey(row.artifact_key) ?? "FINAL_REPORT",
    stageOrder: row.stage_order,
    reviewerRole: normalizeRole(row.reviewer_role),
    status: normalizeReportReviewStageStatus(row.status),
    actedAt: row.acted_at ? ensureIsoDate(row.acted_at) : undefined,
    actedByName: row.acted_by_name ?? undefined,
    actionComment: row.action_comment ?? undefined,
  };
}

export function mapReportReviewComment(row: ReportReviewCommentRow): ReportReviewComment {
  return {
    id: row.id,
    artifactKey: normalizeArtifactKey(row.artifact_key) ?? "FINAL_REPORT",
    reviewStageId: row.review_stage_id ?? undefined,
    authorRole: normalizeRole(row.author_role),
    authorName: row.author_name,
    comment: row.comment,
    status: normalizeReportReviewCommentStatus(row.status),
    createdAt: ensureIsoDate(row.created_at),
    resolvedAt: row.resolved_at ? ensureIsoDate(row.resolved_at) : undefined,
    resolvedByName: row.resolved_by_name ?? undefined,
  };
}

function normalizeRole(role: string): User["role"] {
  const normalized = role.trim().toUpperCase();

  if (normalized === "AIC" || normalized === "STAFF" || normalized === "MANAGER" || normalized === "DIRECTOR" || normalized === "CAE") {
    return normalized;
  }

  return "STAFF";
}

function normalizeControlStatus(status: string): Control["status"] {
  switch (status.trim().toLowerCase()) {
    case "complete":
      return "COMPLETE";
    case "blocked":
      return "BLOCKED";
    case "not_started":
      return "NOT_STARTED";
    default:
      return "IN_PROGRESS";
  }
}

function normalizeQuestionStatus(status: string): Question["status"] {
  switch (status.trim().toLowerCase()) {
    case "responded":
      return "RESPONDED";
    case "overdue":
      return "OVERDUE";
    default:
      return "OPEN";
  }
}

function normalizeRequestStatus(status: string): Request["status"] {
  switch (status.trim().toLowerCase()) {
    case "completed":
      return "COMPLETED";
    case "in_progress":
      return "IN_PROGRESS";
    default:
      return "OPEN";
  }
}

function normalizeAuditPhaseTag(value: string | null | undefined): AuditPhase {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "fieldwork") {
    return "Fieldwork";
  }

  if (normalized === "reporting") {
    return "Reporting";
  }

  return "Planning";
}

function normalizeDocumentStatus(status: string): AuditDocument["status"] {
  switch (status.trim().toLowerCase()) {
    case "complete":
      return "COMPLETE";
    case "in_progress":
      return "IN_PROGRESS";
    default:
      return "NOT_STARTED";
  }
}

function normalizeDocumentType(type: string): AuditDocument["type"] {
  const normalized = type.trim().toUpperCase();

  if (
    normalized === "WORKPAPER" ||
    normalized === "EVIDENCE" ||
    normalized === "REPORT" ||
    normalized === "TOLLGATE" ||
    normalized === "PLANNING_NARRATIVE" ||
    normalized === "PLANNING_TOLLGATE" ||
    normalized === "FIELDWORK_TOLLGATE"
  ) {
    return normalized;
  }

  return "WORKPAPER";
}

function normalizeTestingMatrixAttributeResult(value: string): TestingMatrixAttributeResult {
  const normalized = value.trim().toUpperCase();

  if (normalized === "PASS" || normalized === "FAIL" || normalized === "NOT_TESTED") {
    return normalized;
  }

  return "NOT_TESTED";
}

function normalizeDocumentReviewStatus(status: string | null | undefined): AuditDocument["reviewStatus"] {
  const normalized = status?.trim().toUpperCase();

  if (
    normalized === "NOT_SUBMITTED" ||
    normalized === "AIC_REVIEW" ||
    normalized === "MANAGER_REVIEW" ||
    normalized === "DIRECTOR_REVIEW" ||
    normalized === "APPROVED"
  ) {
    return normalized;
  }

  return undefined;
}

function normalizeArtifactKey(value: string | null | undefined): AuditDocument["artifactKey"] {
  if (value === "FINAL_REPORT" || value === "REPORTING_TOLLGATE") {
    return value;
  }

  return undefined;
}

function normalizeRiskRating(rating: string): Control["riskLevel"] {
  switch (rating.trim().toLowerCase()) {
    case "low":
      return "LOW";
    case "high":
      return "HIGH";
    default:
      return "MEDIUM";
  }
}

function normalizeControlScopeStatus(value: string | null | undefined): ControlScopeStatus {
  const normalized = value?.trim().toUpperCase();

  if (normalized === "IN_SCOPE") {
    return "IN_SCOPE";
  }

  if (normalized === "OUT_OF_SCOPE") {
    return "OUT_OF_SCOPE";
  }

  return "UNASSIGNED";
}

function normalizeFindingStatus(status: string): AuditFinding["status"] {
  switch (status.trim().toLowerCase()) {
    case "in_progress":
      return "IN_PROGRESS";
    case "ready_for_report":
      return "READY_FOR_REPORT";
    case "finalized":
      return "FINALIZED";
    case "closed":
      return "CLOSED";
    default:
      return "OPEN";
  }
}

function normalizeReportReviewStageStatus(status: string): ReportReviewStage["status"] {
  switch (status.trim().toLowerCase()) {
    case "active":
      return "ACTIVE";
    case "approved":
      return "APPROVED";
    case "sent_back":
      return "SENT_BACK";
    default:
      return "PENDING";
  }
}

function normalizeReportReviewCommentStatus(status: string): ReportReviewComment["status"] {
  return status.trim().toLowerCase() === "resolved" ? "RESOLVED" : "OPEN";
}

function compareCreatedRecords(left: { created_at?: string | null; date_sent?: string | null; date_requested?: string | null; id: string }, right: { created_at?: string | null; date_sent?: string | null; date_requested?: string | null; id: string }) {
  const leftTime = getRecordTime(left);
  const rightTime = getRecordTime(right);

  if (leftTime === rightTime) {
    return left.id.localeCompare(right.id);
  }

  return leftTime - rightTime;
}

function getRecordTime(record: { created_at?: string | null; date_sent?: string | null; date_requested?: string | null; id: string }) {
  const value = record.created_at ?? record.date_sent ?? record.date_requested ?? record.id;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatDisplayId(prefix: "Q" | "R" | "F", index: number) {
  return `${prefix}-${String(index + 1).padStart(2, "0")}`;
}

function readText(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function readPreviewSections(payload: Record<string, unknown>) {
  const value = payload.preview_sections;

  if (!Array.isArray(value)) {
    return undefined;
  }

  const sections = value
    .map((section) => {
      if (!section || typeof section !== "object") {
        return null;
      }

      const candidate = section as { heading?: unknown; body?: unknown };

      if (typeof candidate.heading !== "string" || !Array.isArray(candidate.body)) {
        return null;
      }

      return {
        heading: candidate.heading,
        body: candidate.body.map((entry) => String(entry)),
      };
    })
    .filter((section): section is { heading: string; body: string[] } => section !== null);

  return sections.length > 0 ? sections : undefined;
}

function readBoolean(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") {
        return true;
      }

      if (normalized === "false") {
        return false;
      }
    }
  }

  return false;
}

function readDateText(payload: Record<string, unknown>, keys: string[]) {
  const value = readText(payload, keys);
  return value ? ensureIsoDate(value) : undefined;
}

function readTextArray(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];

    if (Array.isArray(value)) {
      const normalized = value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0);

      if (normalized.length > 0) {
        return normalized;
      }
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const normalized = value
        .split(/[;,|\n]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  return [];
}

function toOptionalIsoDate(value: string | null) {
  if (!value) {
    return undefined;
  }

  return value.includes("T") ? value : `${value}T00:00:00.000Z`;
}

function ensureIsoDate(value: string | null) {
  return toOptionalIsoDate(value) ?? new Date().toISOString();
}

export function formatAuditPeriod(periodStart: string, periodEnd: string) {
  const start = new Date(`${periodStart}T00:00:00`);
  const end = new Date(`${periodEnd}T00:00:00`);

  return `${start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} to ${end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export function formatAuditScopePeriod(
  audit: Pick<AuditRecord, "period_start" | "period_end" | "scope_period_start" | "scope_period_end">,
) {
  return formatAuditPeriod(audit.scope_period_start ?? audit.period_start, audit.scope_period_end ?? audit.period_end);
}
