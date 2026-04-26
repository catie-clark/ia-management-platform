import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildArtifactDraft, defaultReportReviewRoles, reportArtifactConfigs } from "@/lib/reporting";
import type { ReportArtifactKey, ReportReviewStage } from "@/types/audit";

export function getReportArtifactSourceRecordKey(artifactKey: ReportArtifactKey, auditId: string) {
  return `${reportArtifactConfigs[artifactKey].sourceRecordKeyPrefix}-${auditId}`;
}

export async function ensureReportWorkflowStages(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  auditId: string,
  artifactKey: ReportArtifactKey,
) {
  const { data: existingStages, error: lookupError } = await supabase
    .from("report_review_stages")
    .select("id, artifact_key, stage_order, reviewer_role, status, acted_at, acted_by_name, action_comment")
    .eq("audit_id", auditId)
    .eq("artifact_key", artifactKey)
    .order("stage_order", { ascending: true });

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if ((existingStages ?? []).length > 0) {
    return existingStages;
  }

  const { data: insertedStages, error: insertError } = await supabase
    .from("report_review_stages")
    .insert(
      defaultReportReviewRoles.map((role, index) => ({
        audit_id: auditId,
        artifact_key: artifactKey,
        stage_order: index + 1,
        reviewer_role: role,
        status: index === 0 ? "active" : "pending",
      })),
    )
    .select("id, artifact_key, stage_order, reviewer_role, status, acted_at, acted_by_name, action_comment")
    .order("stage_order", { ascending: true });

  if (insertError) {
    throw new Error(insertError.message);
  }

  return insertedStages ?? [];
}

export async function upsertReportArtifactDocument(args: {
  auditId: string;
  artifactKey: ReportArtifactKey;
  markdown: string;
  title?: string;
  status?: "not_started" | "in_progress" | "complete";
}) {
  const supabase = createSupabaseAdminClient();
  const config = reportArtifactConfigs[args.artifactKey];
  const sourceRecordKey = getReportArtifactSourceRecordKey(args.artifactKey, args.auditId);
  const preview = buildArtifactDraft(
    args.markdown,
    args.artifactKey === "FINAL_REPORT"
      ? "Draft final report generated from the current audit record."
      : "Draft reporting tollgate generated from the current audit record.",
  );
  const { data, error } = await supabase
    .from("audit_documents")
    .upsert(
      {
        audit_id: args.auditId,
        document_type: config.documentType,
        source_record_key: sourceRecordKey,
        source_system: "platform",
        status: args.status ?? "in_progress",
        template_name: config.templateName,
        title: args.title ?? config.title,
        source_payload: {
          artifact_key: args.artifactKey,
          generated_markdown: args.markdown,
          preview_sections: preview.previewSections,
          preview_summary: preview.previewSummary,
          generated_at: new Date().toISOString(),
        },
      },
      { onConflict: "source_record_key" },
    )
    .select("id, document_type, title, status, due_date, template_name, updated_at, source_payload")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export function getCurrentWorkflowStage(
  stages: Array<{ id: string; reviewer_role: string; status: string; stage_order: number }>,
) {
  return stages.find((stage) => stage.status === "active" || stage.status === "sent_back") ?? null;
}

export function isWorkflowComplete(stages: Array<{ status: string }>) {
  return stages.length > 0 && stages.every((stage) => stage.status === "approved");
}

export function normalizeStageStatus(status: string): ReportReviewStage["status"] {
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
