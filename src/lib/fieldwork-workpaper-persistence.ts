import { buildWorkpaperPreview } from "@/lib/workpaper-content";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AuditDocumentRow } from "@/lib/live-audit";
import type { DocumentReviewStatus, Role, WorkpaperContent } from "@/types/audit";

type WorkpaperDocumentRow = Pick<
  AuditDocumentRow,
  "id" | "document_type" | "title" | "control_id" | "status" | "template_name" | "source_payload" | "updated_at"
>;

type WorkpaperDocumentDbRow = WorkpaperDocumentRow & {
  owner_user_id: string | null;
};

export async function loadWorkpaperDocument(auditId: string, documentId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("audit_documents")
    .select("id, document_type, title, control_id, owner_user_id, status, template_name, source_payload, updated_at")
    .eq("audit_id", auditId)
    .eq("id", documentId)
    .eq("document_type", "WORKPAPER")
    .maybeSingle<WorkpaperDocumentDbRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("The requested workpaper was not found.");
  }

  return data;
}

export async function saveWorkpaperDraft({
  auditId,
  content,
  documentId,
}: {
  auditId: string;
  content: WorkpaperContent;
  documentId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const existingDocument = await loadWorkpaperDocument(auditId, documentId);
  const now = new Date().toISOString();
  const preview = buildWorkpaperPreview(content);
  const nextPayload = {
    ...(existingDocument.source_payload ?? {}),
    edited_at: now,
    preview_sections: preview.previewSections,
    preview_summary: preview.previewSummary,
    workpaper_content: {
      summary: content.summary,
      objective: content.objective,
      scope: content.scope,
      procedures: content.procedures,
      results: content.results,
      conclusion: content.conclusion,
      next_steps: content.nextSteps,
    },
  };
  const { data, error } = await supabase
    .from("audit_documents")
    .update({
      owner_user_id: await getDocumentOwnerUserId(auditId, existingDocument.control_id),
      source_payload: nextPayload,
      status: existingDocument.status === "complete" ? "complete" : "in_progress",
    })
    .eq("id", existingDocument.id)
    .select("id, document_type, title, control_id, owner_user_id, status, template_name, source_payload, updated_at")
    .maybeSingle<WorkpaperDocumentDbRow>();

  if (error) {
    throw new Error(error.message);
  }

  return {
    data,
    payload: nextPayload,
  };
}

export async function applyWorkpaperReviewAction({
  action,
  actingRole,
  actingUserName,
  auditId,
  comment,
  content,
  documentId,
}: {
  action: "approve" | "send_back" | "send_to_review";
  actingRole: Role;
  actingUserName: string;
  auditId: string;
  comment?: string;
  content?: WorkpaperContent;
  documentId: string;
}) {
  const existingDocument = content ? (await saveWorkpaperDraft({ auditId, content, documentId })).data ?? (await loadWorkpaperDocument(auditId, documentId)) : await loadWorkpaperDocument(auditId, documentId);
  const supabase = createSupabaseAdminClient();
  const payload = { ...(existingDocument.source_payload ?? {}) };
  const now = new Date().toISOString();
  const currentReviewStatus = normalizeReviewStatus(payload.review_status);
  const trimmedComment = comment?.trim();

  let nextReviewStatus: DocumentReviewStatus;
  let nextDocumentStatus: "complete" | "in_progress";

  if (action === "send_to_review") {
    nextReviewStatus = "AIC_REVIEW";
    nextDocumentStatus = "in_progress";
  } else if (action === "send_back") {
    nextReviewStatus = "NOT_SUBMITTED";
    nextDocumentStatus = "in_progress";
  } else {
    nextReviewStatus = getNextReviewStatus(currentReviewStatus);
    nextDocumentStatus = nextReviewStatus === "APPROVED" ? "complete" : "in_progress";
  }

  const nextPayload: Record<string, unknown> = {
    ...payload,
    last_review_action: action,
    last_review_actor_name: actingUserName,
    last_review_actor_role: actingRole,
    last_review_action_at: now,
    review_status: nextReviewStatus,
  };

  if (action === "send_back") {
    nextPayload.review_comment = trimmedComment ?? "";
    nextPayload.review_comment_author = actingUserName;
    nextPayload.review_comment_date = now;
  } else if (trimmedComment) {
    nextPayload.review_comment = trimmedComment;
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
      owner_user_id: await getDocumentOwnerUserId(auditId, existingDocument.control_id),
      source_payload: nextPayload,
      status: nextDocumentStatus,
    })
    .eq("id", existingDocument.id)
    .select("id, document_type, title, control_id, owner_user_id, status, template_name, source_payload, updated_at")
    .maybeSingle<WorkpaperDocumentDbRow>();

  if (error) {
    throw new Error(error.message);
  }

  return {
    data,
    payload: nextPayload,
  };
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

function getNextReviewStatus(currentReviewStatus: DocumentReviewStatus): DocumentReviewStatus {
  if (currentReviewStatus === "AIC_REVIEW") {
    return "MANAGER_REVIEW";
  }

  if (currentReviewStatus === "MANAGER_REVIEW") {
    return "DIRECTOR_REVIEW";
  }

  return "APPROVED";
}

async function getDocumentOwnerUserId(auditId: string, controlId: string | null | undefined) {
  if (!controlId) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("controls")
    .select("assigned_owner_user_id, control_owner_user_id")
    .eq("audit_id", auditId)
    .eq("id", controlId)
    .maybeSingle<{ assigned_owner_user_id: string | null; control_owner_user_id: string | null }>();

  if (error) {
    throw new Error(error.message);
  }

  return data?.assigned_owner_user_id ?? data?.control_owner_user_id ?? null;
}
