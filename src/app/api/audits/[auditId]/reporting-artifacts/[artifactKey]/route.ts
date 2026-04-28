import { NextResponse } from "next/server";
import { z } from "zod";

import { getReportingViewModel } from "@/lib/reporting-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getReportArtifactSourceRecordKey } from "@/lib/reporting-persistence";
import { upsertReportArtifactDocument } from "@/lib/reporting-persistence";

const artifactKeySchema = z.enum(["FINAL_REPORT", "REPORTING_TOLLGATE"]);

const saveArtifactSchema = z.object({
  markdown: z.string().min(1),
  title: z.string().min(1).optional(),
});

export async function POST(_request: Request, context: { params: Promise<{ auditId: string; artifactKey: string }> }) {
  try {
    const { auditId, artifactKey: rawArtifactKey } = await context.params;
    const artifactKey = artifactKeySchema.parse(rawArtifactKey);
    const viewModel = await getReportingViewModel({ auditId, mode: "live" });
    const draft = artifactKey === "FINAL_REPORT" ? viewModel.finalReportDraft : viewModel.reportingTollgateDraft;
    const data = await upsertReportArtifactDocument({
      auditId,
      artifactKey,
      markdown: draft.markdown,
      title: draft.title,
      status: "in_progress",
    });

    return NextResponse.json({
      artifact: {
        artifactKey,
        documentId: data?.id ?? null,
        markdown: draft.markdown,
        previewSections: draft.previewSections,
        previewSummary: draft.previewSummary,
        status: "IN_PROGRESS",
        templateName: draft.templateName,
        title: draft.title,
        updatedAt: data?.updated_at ?? new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to generate the reporting artifact.",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ auditId: string; artifactKey: string }> }) {
  try {
    const { auditId, artifactKey: rawArtifactKey } = await context.params;
    const artifactKey = artifactKeySchema.parse(rawArtifactKey);
    const body = saveArtifactSchema.parse(await request.json());
    const data = await upsertReportArtifactDocument({
      auditId,
      artifactKey,
      markdown: body.markdown,
      title: body.title,
      status: "in_progress",
    });

    return NextResponse.json({
      artifact: {
        artifactKey,
        documentId: data?.id ?? null,
        markdown: body.markdown,
        previewSections: data?.source_payload?.preview_sections ?? [],
        previewSummary: data?.source_payload?.preview_summary ?? "",
        status: "IN_PROGRESS",
        templateName: data?.template_name ?? null,
        title: data?.title ?? body.title ?? null,
        updatedAt: data?.updated_at ?? new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid reporting artifact payload." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to save the reporting artifact.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ auditId: string; artifactKey: string }> }) {
  try {
    const { auditId, artifactKey: rawArtifactKey } = await context.params;
    const artifactKey = artifactKeySchema.parse(rawArtifactKey);
    const supabase = createSupabaseAdminClient();
    const sourceRecordKey = getReportArtifactSourceRecordKey(artifactKey, auditId);

    const { error: commentError } = await supabase
      .from("report_review_comments")
      .delete()
      .eq("audit_id", auditId)
      .eq("artifact_key", artifactKey);

    if (commentError) {
      throw new Error(commentError.message);
    }

    const { error: stageError } = await supabase
      .from("report_review_stages")
      .delete()
      .eq("audit_id", auditId)
      .eq("artifact_key", artifactKey);

    if (stageError) {
      throw new Error(stageError.message);
    }

    const { error: documentError } = await supabase
      .from("audit_documents")
      .delete()
      .eq("audit_id", auditId)
      .eq("source_record_key", sourceRecordKey);

    if (documentError) {
      throw new Error(documentError.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to reset the reporting artifact.",
      },
      { status: 400 },
    );
  }
}
