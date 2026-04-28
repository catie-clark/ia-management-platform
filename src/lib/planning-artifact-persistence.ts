import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DocumentReviewStatus, Role } from "@/types/audit";

export type PlanningArtifactDocumentType = "PLANNING_NARRATIVE" | "PLANNING_TOLLGATE" | "FIELDWORK_TOLLGATE";
export type PlanningArtifactEndpointPath = "planning-narrative" | "planning-tollgate" | "fieldwork-tollgate";

type PlanningArtifactDocumentRow = {
  id: string;
  owner_user_id: string | null;
  source_payload: Record<string, unknown>;
  status: string;
  template_name: string | null;
  title: string;
  updated_at: string;
};

type AuditUserRow = {
  full_name: string;
  id: string;
  role: string;
};

export async function loadPlanningArtifactDocument(auditId: string, documentType: PlanningArtifactDocumentType) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("audit_documents")
    .select("id, title, owner_user_id, status, template_name, source_payload, updated_at")
    .eq("audit_id", auditId)
    .eq("document_type", documentType)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<PlanningArtifactDocumentRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function findPlanningArtifactOwner(auditId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: users, error } = await supabase
    .from("users")
    .select("id, full_name, role")
    .eq("role", "AIC")
    .order("full_name", { ascending: true })
    .returns<AuditUserRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  const preferredOwner =
    users?.find((user) => user.full_name.trim().toLowerCase() === "jordan lee") ??
    users?.find((user) => user.role.toUpperCase() === "AIC") ??
    null;

  return preferredOwner
    ? {
        id: preferredOwner.id,
        name: preferredOwner.full_name,
        role: "AIC" as const,
      }
    : null;
}

export async function readPlanningArtifactOwner(ownerUserId: string | null) {
  if (!ownerUserId) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, role")
    .eq("id", ownerUserId)
    .maybeSingle<AuditUserRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    name: data.full_name,
    role: normalizeRole(data.role),
  };
}

export async function applyPlanningArtifactReviewAction({
  action,
  actingRole,
  actingUserName,
  auditId,
  comment,
  documentType,
}: {
  action: "approve" | "send_back" | "submit";
  actingRole: Role;
  actingUserName: string;
  auditId: string;
  comment?: string;
  documentType: PlanningArtifactDocumentType;
}) {
  const existingDocument = await loadPlanningArtifactDocument(auditId, documentType);

  if (!existingDocument) {
    throw new Error("No planning draft exists for this audit yet.");
  }

  const supabase = createSupabaseAdminClient();
  const payload = { ...(existingDocument.source_payload ?? {}) };
  const now = new Date().toISOString();
  const trimmedComment = comment?.trim();
  const currentReviewStatus = normalizeReviewStatus(payload.review_status);

  let nextReviewStatus: DocumentReviewStatus;
  let nextDocumentStatus: "in_progress" | "complete";

  if (action === "submit") {
    nextReviewStatus = "MANAGER_REVIEW";
    nextDocumentStatus = "in_progress";
  } else if (action === "send_back") {
    nextReviewStatus = "NOT_SUBMITTED";
    nextDocumentStatus = "in_progress";
  } else {
    nextReviewStatus = getNextPlanningReviewStatus(currentReviewStatus);
    nextDocumentStatus = nextReviewStatus === "APPROVED" ? "complete" : "in_progress";
  }

  const nextPayload: Record<string, unknown> = {
    ...payload,
    last_review_action: action,
    last_review_action_at: now,
    last_review_actor_name: actingUserName,
    last_review_actor_role: actingRole,
    review_status: nextReviewStatus,
  };

  if (action === "send_back") {
    nextPayload.review_comment = trimmedComment ?? "";
    nextPayload.review_comment_author = actingUserName;
    nextPayload.review_comment_date = now;
  } else {
    delete nextPayload.review_comment;
    delete nextPayload.review_comment_author;
    delete nextPayload.review_comment_date;
  }

  const { data, error } = await supabase
    .from("audit_documents")
    .update({
      source_payload: nextPayload,
      status: nextDocumentStatus,
    })
    .eq("id", existingDocument.id)
    .select("id, title, owner_user_id, status, source_payload, updated_at")
    .maybeSingle<PlanningArtifactDocumentRow>();

  if (error) {
    throw new Error(error.message);
  }

  return {
    data,
    payload: nextPayload,
  };
}

export async function savePlanningArtifactDraft(args: {
  auditId: string;
  documentType: PlanningArtifactDocumentType;
  ownerUserId: string | null;
  payload: Record<string, unknown>;
  sourceRecordKey: string;
  status?: "in_progress" | "complete";
  templateName: string;
  title: string;
}) {
  const supabase = createSupabaseAdminClient();
  const existingDocument = await loadPlanningArtifactDocument(args.auditId, args.documentType);
  const values = {
    owner_user_id: args.ownerUserId,
    source_payload: args.payload,
    status: args.status ?? "in_progress",
    template_name: args.templateName,
    title: args.title,
  };

  if (existingDocument) {
    const { data, error } = await supabase
      .from("audit_documents")
      .update(values)
      .eq("id", existingDocument.id)
      .select("id, title, owner_user_id, status, template_name, source_payload, updated_at")
      .maybeSingle<PlanningArtifactDocumentRow>();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  const { data, error } = await supabase
    .from("audit_documents")
    .insert({
      audit_id: args.auditId,
      document_type: args.documentType,
      source_record_key: args.sourceRecordKey,
      source_system: "platform",
      ...values,
    })
    .select("id, title, owner_user_id, status, template_name, source_payload, updated_at")
    .maybeSingle<PlanningArtifactDocumentRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export function getPlanningArtifactDocumentType(endpointPath: PlanningArtifactEndpointPath): PlanningArtifactDocumentType {
  if (endpointPath === "planning-tollgate") {
    return "PLANNING_TOLLGATE";
  }

  if (endpointPath === "fieldwork-tollgate") {
    return "FIELDWORK_TOLLGATE";
  }

  return "PLANNING_NARRATIVE";
}

function normalizeReviewStatus(value: unknown): DocumentReviewStatus {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";

  if (
    normalized === "NOT_SUBMITTED" ||
    normalized === "AIC_REVIEW" ||
    normalized === "MANAGER_REVIEW" ||
    normalized === "DIRECTOR_REVIEW" ||
    normalized === "APPROVED"
  ) {
    return normalized;
  }

  return "NOT_SUBMITTED";
}

function getNextPlanningReviewStatus(currentReviewStatus: DocumentReviewStatus): DocumentReviewStatus {
  if (currentReviewStatus === "MANAGER_REVIEW") {
    return "DIRECTOR_REVIEW";
  }

  return "APPROVED";
}

function normalizeRole(value: string): Role {
  const normalized = value.trim().toUpperCase();

  if (normalized === "AIC" || normalized === "STAFF" || normalized === "MANAGER" || normalized === "DIRECTOR" || normalized === "CAE") {
    return normalized;
  }

  return "STAFF";
}
