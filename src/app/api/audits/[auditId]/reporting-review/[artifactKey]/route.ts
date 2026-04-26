import { NextResponse } from "next/server";
import { z } from "zod";

import { createNotificationsForRole } from "@/lib/audit-notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  ensureReportWorkflowStages,
  getCurrentWorkflowStage,
  getReportArtifactSourceRecordKey,
  isWorkflowComplete,
  upsertReportArtifactDocument,
} from "@/lib/reporting-persistence";

const reviewActionSchema = z.object({
  action: z.enum(["submit", "approve", "send_back", "resolve_comments"]),
  actingRole: z.enum(["AIC", "STAFF", "MANAGER", "DIRECTOR", "CAE"]),
  actingUserName: z.string().min(1),
  comment: z.string().optional(),
});

const artifactKeySchema = z.enum(["FINAL_REPORT", "REPORTING_TOLLGATE"]);

export async function PATCH(request: Request, context: { params: Promise<{ auditId: string; artifactKey: string }> }) {
  try {
    const { auditId, artifactKey: rawArtifactKey } = await context.params;
    const artifactKey = artifactKeySchema.parse(rawArtifactKey);
    const body = reviewActionSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const stages = await ensureReportWorkflowStages(supabase, auditId, artifactKey);
    const currentStage = getCurrentWorkflowStage(stages);
    const artifactLabel = artifactKey === "FINAL_REPORT" ? "Final report" : "Reporting tollgate";

    if (body.action === "submit") {
      await upsertArtifactStatus(auditId, artifactKey, "in_progress");
      if (currentStage) {
        await safelyCreateNotification(() =>
          createNotificationsForRole({
            auditId,
            detail: `${artifactLabel} is ready for ${currentStage.reviewer_role} review.`,
            entityId: currentStage.id,
            entityType: "reporting_artifact",
            eventType: "REPORT_REVIEW_SUBMITTED",
            linkHref: `/reporting?mode=live&auditId=${auditId}`,
            role: normalizeRole(currentStage.reviewer_role),
            title: "A reporting artifact is ready for review",
            tone: "warning",
          }),
        );
      }

      return NextResponse.json({ ok: true });
    }

    if (body.action === "resolve_comments") {
      if (body.actingRole !== "AIC") {
        return NextResponse.json({ error: "Only the AIC can resolve and resubmit reporting comments." }, { status: 409 });
      }

      if (!currentStage) {
        return NextResponse.json({ error: "No active review stage exists for this artifact." }, { status: 409 });
      }

      const { error: resolveError } = await supabase
        .from("report_review_comments")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by_name: body.actingUserName,
        })
        .eq("audit_id", auditId)
        .eq("artifact_key", artifactKey)
        .eq("status", "open");

      if (resolveError) {
        throw new Error(resolveError.message);
      }

      if (currentStage && currentStage.status === "sent_back") {
        const { error: stageError } = await supabase
          .from("report_review_stages")
          .update({
            status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentStage.id);

        if (stageError) {
          throw new Error(stageError.message);
        }
      }

      await safelyCreateNotification(() =>
        createNotificationsForRole({
          auditId,
          detail: `${artifactLabel} was resubmitted and is waiting for ${currentStage.reviewer_role} review.`,
          entityId: currentStage.id,
          entityType: "reporting_artifact",
          eventType: "REPORT_REVIEW_RESUBMITTED",
          linkHref: `/reporting?mode=live&auditId=${auditId}`,
          role: normalizeRole(currentStage.reviewer_role),
          title: "A reporting artifact was resubmitted for review",
          tone: "warning",
        }),
      );

      return NextResponse.json({ ok: true });
    }

    if (!currentStage) {
      return NextResponse.json({ error: "No active review stage exists for this artifact." }, { status: 409 });
    }

    if (currentStage.reviewer_role !== body.actingRole) {
      return NextResponse.json(
        { error: `This artifact is waiting on ${currentStage.reviewer_role} review, not ${body.actingRole}.` },
        { status: 409 },
      );
    }

    if (body.action === "send_back") {
      const comment = body.comment?.trim();

      if (!comment) {
        return NextResponse.json({ error: "A send-back comment is required." }, { status: 400 });
      }

      const { error: stageError } = await supabase
        .from("report_review_stages")
        .update({
          status: "sent_back",
          acted_at: new Date().toISOString(),
          acted_by_name: body.actingUserName,
          action_comment: comment,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentStage.id);

      if (stageError) {
        throw new Error(stageError.message);
      }

      const { error: commentError } = await supabase.from("report_review_comments").insert({
        audit_id: auditId,
        artifact_key: artifactKey,
        review_stage_id: currentStage.id,
        author_role: body.actingRole,
        author_name: body.actingUserName,
        comment,
        status: "open",
      });

      if (commentError) {
        throw new Error(commentError.message);
      }

      await upsertArtifactStatus(auditId, artifactKey, "in_progress");
      await safelyCreateNotification(() =>
        createNotificationsForRole({
          auditId,
          detail: `${artifactLabel} was sent back with reviewer comments.`,
          entityId: currentStage.id,
          entityType: "reporting_artifact",
          eventType: "REPORT_REVIEW_SENT_BACK",
          linkHref: `/reporting?mode=live&auditId=${auditId}`,
          role: "AIC",
          title: "A reporting artifact was sent back",
          tone: "warning",
        }),
      );
      return NextResponse.json({ ok: true });
    }

    const { error: approveStageError } = await supabase
      .from("report_review_stages")
      .update({
        status: "approved",
        acted_at: new Date().toISOString(),
        acted_by_name: body.actingUserName,
        action_comment: body.comment?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentStage.id);

    if (approveStageError) {
      throw new Error(approveStageError.message);
    }

    const nextStage = stages.find((stage) => stage.stage_order === currentStage.stage_order + 1);

    if (nextStage) {
      const { error: nextStageError } = await supabase
        .from("report_review_stages")
        .update({
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", nextStage.id)
        .eq("status", "pending");

      if (nextStageError) {
        throw new Error(nextStageError.message);
      }
    }

    const refreshedStages = await ensureReportWorkflowStages(supabase, auditId, artifactKey);
    if (isWorkflowComplete(refreshedStages)) {
      await upsertArtifactStatus(auditId, artifactKey, "complete");
      await safelyCreateNotification(() =>
        createNotificationsForRole({
          auditId,
          detail: `${artifactLabel} completed the review workflow.`,
          entityId: currentStage.id,
          entityType: "reporting_artifact",
          eventType: "REPORT_REVIEW_APPROVED",
          linkHref: `/reporting?mode=live&auditId=${auditId}`,
          role: "AIC",
          title: "A reporting artifact was fully approved",
          tone: "success",
        }),
      );
    } else {
      await upsertArtifactStatus(auditId, artifactKey, "in_progress");
      if (nextStage) {
        await safelyCreateNotification(() =>
          createNotificationsForRole({
            auditId,
            detail: `${artifactLabel} is ready for ${nextStage.reviewer_role} review.`,
            entityId: nextStage.id,
            entityType: "reporting_artifact",
            eventType: "REPORT_REVIEW_ADVANCED",
            linkHref: `/reporting?mode=live&auditId=${auditId}`,
            role: normalizeRole(nextStage.reviewer_role),
            title: "A reporting artifact is ready for your review",
            tone: "warning",
          }),
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid review action payload." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update the reporting review workflow.",
      },
      { status: 400 },
    );
  }
}

function normalizeRole(role: string) {
  const normalized = role.trim().toUpperCase();
  if (normalized === "AIC" || normalized === "STAFF" || normalized === "MANAGER" || normalized === "DIRECTOR" || normalized === "CAE") {
    return normalized;
  }

  return "AIC";
}

async function safelyCreateNotification(callback: () => Promise<void>) {
  try {
    await callback();
  } catch (error) {
    console.error("Unable to create reporting notification", error);
  }
}

async function upsertArtifactStatus(auditId: string, artifactKey: z.infer<typeof artifactKeySchema>, status: "in_progress" | "complete") {
  const supabase = createSupabaseAdminClient();
  const sourceRecordKey = getReportArtifactSourceRecordKey(artifactKey, auditId);
  const { data: existingDocument, error: lookupError } = await supabase
    .from("audit_documents")
    .select("id, source_payload, title")
    .eq("audit_id", auditId)
    .eq("source_record_key", sourceRecordKey)
    .limit(1)
    .maybeSingle<{ id: string; source_payload: Record<string, unknown>; title: string }>();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!existingDocument) {
    await upsertReportArtifactDocument({
      auditId,
      artifactKey,
      markdown: artifactKey === "FINAL_REPORT" ? "# Internal Audit Report Draft" : "# Reporting Tollgate Draft",
      status,
    });
    return;
  }

  const { error } = await supabase
    .from("audit_documents")
    .update({
      status,
      source_payload: existingDocument.source_payload,
    })
    .eq("id", existingDocument.id);

  if (error) {
    throw new Error(error.message);
  }
}
