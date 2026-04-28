import { NextResponse } from "next/server";
import { z } from "zod";

import { getFieldworkTollgateViewModel } from "@/lib/fieldwork-tollgate/view-model";
import { findPlanningArtifactOwner, readPlanningArtifactOwner, savePlanningArtifactDraft } from "@/lib/planning-artifact-persistence";
import { buildNarrativePreview, sanitizeDraftMarkdown } from "@/lib/planning-narrative/format";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateFieldworkTollgateDraftSchema = z.object({
  markdown: z.string().min(1),
});

type FieldworkTollgateDocumentRow = {
  id: string;
  owner_user_id: string | null;
  status: string;
  template_name: string | null;
  title: string;
  updated_at: string;
  source_payload: Record<string, unknown>;
};

export async function GET(_request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("audit_documents")
      .select("id, title, owner_user_id, status, template_name, updated_at, source_payload")
      .eq("audit_id", auditId)
      .eq("document_type", "FIELDWORK_TOLLGATE")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<FieldworkTollgateDocumentRow>();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return NextResponse.json({ draft: null });
    }

    const sanitizedMarkdown = sanitizeDraftMarkdown(readString(data.source_payload, "generated_markdown") ?? "");
    const preview = buildNarrativePreview(sanitizedMarkdown);
    const owner = await readPlanningArtifactOwner(data.owner_user_id);

    return NextResponse.json({
      draft: {
        documentId: data.id,
        generatedAt: resolveDraftTimestamp(data),
        markdown: sanitizedMarkdown,
        missingRequiredTokens: readStringArray(data.source_payload, "missing_required_tokens"),
        ownerName: owner?.name ?? null,
        ownerRole: owner?.role ?? null,
        previewSections: preview.previewSections,
        previewSummary: preview.previewSummary,
        reviewComment: readString(data.source_payload, "review_comment"),
        reviewCommentAuthor: readString(data.source_payload, "review_comment_author"),
        reviewCommentDate: readString(data.source_payload, "review_comment_date"),
        reviewStatus: readString(data.source_payload, "review_status") ?? "NOT_SUBMITTED",
        status: data.status,
        templateName: data.template_name,
        title: data.title,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load the fieldwork tollgate." },
      { status: 400 },
    );
  }
}

export async function POST(_request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const viewModel = await getFieldworkTollgateViewModel(auditId);
    const sanitizedMarkdown = sanitizeDraftMarkdown(viewModel.renderedTemplate);
    const preview = buildNarrativePreview(sanitizedMarkdown);
    const sourceRecordKey = `fieldwork-tollgate-${auditId}`;
    const owner = await findPlanningArtifactOwner(auditId);
    const payload = {
      generated_markdown: sanitizedMarkdown,
      missing_required_tokens: viewModel.missingRequiredTokens,
      preview_sections: preview.previewSections,
      preview_summary: preview.previewSummary,
      rendered_template: sanitizedMarkdown,
      token_values: viewModel.tokenValues,
      generated_at: new Date().toISOString(),
      review_status: "NOT_SUBMITTED",
    };

    const persistedDraft = await savePlanningArtifactDraft({
      auditId,
      documentType: "FIELDWORK_TOLLGATE",
      ownerUserId: owner?.id ?? null,
      payload,
      sourceRecordKey,
      status: "in_progress",
      templateName: "System Fieldwork Tollgate Template",
      title: "Fieldwork Tollgate Draft",
    });
    const persistedOwner = await readPlanningArtifactOwner(persistedDraft?.owner_user_id ?? owner?.id ?? null);

    return NextResponse.json({
      draft: {
        documentId: persistedDraft?.id ?? null,
        generatedAt: resolveDraftTimestamp(persistedDraft) ?? payload.generated_at,
        markdown: sanitizedMarkdown,
        missingRequiredTokens: viewModel.missingRequiredTokens,
        ownerName: persistedOwner?.name ?? owner?.name ?? null,
        ownerRole: persistedOwner?.role ?? owner?.role ?? null,
        previewSections: preview.previewSections,
        previewSummary: preview.previewSummary,
        reviewComment: null,
        reviewCommentAuthor: null,
        reviewCommentDate: null,
        reviewStatus: "NOT_SUBMITTED",
        status: persistedDraft?.status ?? "IN_PROGRESS",
        templateName: persistedDraft?.template_name ?? "System Fieldwork Tollgate Template",
        title: persistedDraft?.title ?? "Fieldwork Tollgate Draft",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate the fieldwork tollgate." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const body = updateFieldworkTollgateDraftSchema.parse(await request.json());
    const sanitizedMarkdown = sanitizeDraftMarkdown(body.markdown);
    const preview = buildNarrativePreview(sanitizedMarkdown);
    const supabase = createSupabaseAdminClient();
    const { data: existingDraft, error: lookupError } = await supabase
      .from("audit_documents")
      .select("id, owner_user_id, source_payload")
      .eq("audit_id", auditId)
      .eq("document_type", "FIELDWORK_TOLLGATE")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; owner_user_id: string | null; source_payload: Record<string, unknown> }>();

    if (lookupError) {
      throw new Error(lookupError.message);
    }

    if (!existingDraft) {
      return NextResponse.json({ error: "No fieldwork tollgate draft exists for this audit yet." }, { status: 404 });
    }

    if (isPlanningDraftLockedForReview(readString(existingDraft.source_payload, "review_status"))) {
      return NextResponse.json({ error: "This fieldwork tollgate is locked while it is in review." }, { status: 409 });
    }

    const owner = await readPlanningArtifactOwner(existingDraft.owner_user_id);
    const nextPayload = {
      ...existingDraft.source_payload,
      generated_markdown: sanitizedMarkdown,
      preview_sections: preview.previewSections,
      preview_summary: preview.previewSummary,
      edited_at: new Date().toISOString(),
      review_status: "NOT_SUBMITTED",
    };

    const { data, error } = await supabase
      .from("audit_documents")
      .update({
        source_payload: nextPayload,
        status: "in_progress",
      })
      .eq("id", existingDraft.id)
      .select("id, title, status, template_name, updated_at, source_payload")
      .maybeSingle<FieldworkTollgateDocumentRow>();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      draft: {
        documentId: data?.id ?? existingDraft.id,
        generatedAt: resolveDraftTimestamp(data) ?? nextPayload.edited_at,
        markdown: sanitizedMarkdown,
        missingRequiredTokens: readStringArray(nextPayload, "missing_required_tokens"),
        ownerName: owner?.name ?? null,
        ownerRole: owner?.role ?? null,
        previewSections: preview.previewSections,
        previewSummary: preview.previewSummary,
        reviewComment: readString(nextPayload, "review_comment"),
        reviewCommentAuthor: readString(nextPayload, "review_comment_author"),
        reviewCommentDate: readString(nextPayload, "review_comment_date"),
        reviewStatus: readString(nextPayload, "review_status") ?? "NOT_SUBMITTED",
        status: data?.status ?? "IN_PROGRESS",
        templateName: data?.template_name ?? "System Fieldwork Tollgate Template",
        title: data?.title ?? "Fieldwork Tollgate Draft",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid fieldwork tollgate payload." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update the fieldwork tollgate." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const supabase = createSupabaseAdminClient();
    const { data: existingDraft, error: lookupError } = await supabase
      .from("audit_documents")
      .select("id")
      .eq("audit_id", auditId)
      .eq("document_type", "FIELDWORK_TOLLGATE")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (lookupError) {
      throw new Error(lookupError.message);
    }

    if (!existingDraft) {
      return NextResponse.json({ draft: null });
    }

    const { error } = await supabase.from("audit_documents").delete().eq("id", existingDraft.id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ draft: null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reset the fieldwork tollgate." },
      { status: 400 },
    );
  }
}

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

function readStringArray(payload: Record<string, unknown>, key: string) {
  const value = payload[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => String(entry));
}

function resolveDraftTimestamp(document: FieldworkTollgateDocumentRow | null | undefined) {
  if (!document) {
    return null;
  }

  return readString(document.source_payload, "edited_at") ?? readString(document.source_payload, "generated_at") ?? document.updated_at;
}

function isPlanningDraftLockedForReview(status: string | null) {
  return status === "AIC_REVIEW" || status === "MANAGER_REVIEW" || status === "DIRECTOR_REVIEW";
}
