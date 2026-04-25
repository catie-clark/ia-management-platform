import type { AuditDocument, Control, Question, Request, User } from "@/types/audit";

export type DashboardMode = "prototype" | "live";

export type AuditRecord = {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
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
  source_payload: Record<string, unknown>;
};

export type QuestionRow = {
  id: string;
  control_id: string | null;
  asked_by_user_id: string | null;
  assigned_to: string;
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
};

export type UserRow = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  team: string | null;
};

export type BusinessUnitRow = {
  id: string;
  name: string;
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
  const ownerId = control.assigned_owner_user_id ?? control.control_owner_user_id ?? "";
  const hasPlanningOverride =
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
    description: request.description,
    assignedTo: request.requested_from,
    dateRequested: ensureIsoDate(request.date_requested),
    dueDate: ensureIsoDate(request.due_date),
    status: normalizeRequestStatus(request.status),
    responseNotes: request.response_notes ?? undefined,
  };
}

export function mapDocument(document: AuditDocumentRow): AuditDocument {
  return {
    id: document.id,
    type: normalizeDocumentType(document.document_type),
    title: document.title,
    linkedControlId: document.control_id ?? undefined,
    linkedQuestionId: document.question_id ?? undefined,
    linkedRequestId: document.request_id ?? undefined,
    ownerId: document.owner_user_id ?? "",
    status: normalizeDocumentStatus(document.status),
    dueDate: document.due_date ? ensureIsoDate(document.due_date) : undefined,
    templateName: document.template_name ?? undefined,
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
    normalized === "PLANNING_NARRATIVE"
  ) {
    return normalized;
  }

  return "WORKPAPER";
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

function readText(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
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
