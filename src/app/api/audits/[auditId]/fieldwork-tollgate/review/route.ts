import { NextResponse } from "next/server";
import { z } from "zod";

import { createNotificationForUserId, createNotificationsForRole } from "@/lib/audit-notifications";
import { applyPlanningArtifactReviewAction, loadPlanningArtifactDocument } from "@/lib/planning-artifact-persistence";

const reviewActionSchema = z
  .object({
    action: z.enum(["approve", "send_back", "submit"]),
    actingRole: z.enum(["AIC", "STAFF", "MANAGER", "DIRECTOR", "CAE"]),
    actingUserName: z.string().min(1),
    comment: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.action === "send_back" && (!value.comment || value.comment.trim().length === 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A send-back comment is required.",
        path: ["comment"],
      });
    }
  });

export async function PATCH(request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const body = reviewActionSchema.parse(await request.json());
    const result = await applyPlanningArtifactReviewAction({
      action: body.action,
      actingRole: body.actingRole,
      actingUserName: body.actingUserName,
      auditId,
      comment: body.comment,
      documentType: "FIELDWORK_TOLLGATE",
    });
    const document = result.data ?? (await loadPlanningArtifactDocument(auditId, "FIELDWORK_TOLLGATE"));
    const nextReviewStatus = typeof result.payload.review_status === "string" ? result.payload.review_status : "NOT_SUBMITTED";

    await safelyCreateNotification(async () => {
      if (body.action === "submit") {
        await createNotificationsForRole({
          auditId,
          detail: `${document?.title ?? "Fieldwork tollgate"} is waiting for manager review.`,
          entityId: document?.id ?? null,
          entityType: "fieldwork_tollgate",
          eventType: "FIELDWORK_TOLLGATE_MANAGER_REVIEW",
          linkHref: `/fieldwork?mode=live&auditId=${auditId}`,
          role: "MANAGER",
          title: "A fieldwork tollgate is ready for manager review",
          tone: "warning",
        });
        return;
      }

      if (body.action === "send_back") {
        if (document?.owner_user_id) {
          await createNotificationForUserId({
            auditId,
            detail: body.comment?.trim() || `${document?.title ?? "Fieldwork tollgate"} was sent back for updates.`,
            entityId: document.id,
            entityType: "fieldwork_tollgate",
            eventType: "FIELDWORK_TOLLGATE_SENT_BACK",
            linkHref: `/fieldwork?mode=live&auditId=${auditId}`,
            title: "A fieldwork tollgate was sent back to you",
            tone: "warning",
            userId: document.owner_user_id,
          });
        }
        return;
      }

      if (nextReviewStatus === "DIRECTOR_REVIEW") {
        await createNotificationsForRole({
          auditId,
          detail: `${document?.title ?? "Fieldwork tollgate"} is waiting for director review.`,
          entityId: document?.id ?? null,
          entityType: "fieldwork_tollgate",
          eventType: "FIELDWORK_TOLLGATE_DIRECTOR_REVIEW",
          linkHref: `/fieldwork?mode=live&auditId=${auditId}`,
          role: "DIRECTOR",
          title: "A fieldwork tollgate is ready for director review",
          tone: "warning",
        });
        return;
      }

      if (nextReviewStatus === "APPROVED" && document?.owner_user_id) {
        await createNotificationForUserId({
          auditId,
          detail: `${document?.title ?? "Fieldwork tollgate"} completed the review workflow.`,
          entityId: document.id,
          entityType: "fieldwork_tollgate",
          eventType: "FIELDWORK_TOLLGATE_APPROVED",
          linkHref: `/fieldwork?mode=live&auditId=${auditId}`,
          title: "Your fieldwork tollgate was approved",
          tone: "success",
          userId: document.owner_user_id,
        });
      }
    });

    return NextResponse.json({
      draft: {
        reviewComment: result.payload.review_comment ?? null,
        reviewCommentAuthor: result.payload.review_comment_author ?? null,
        reviewCommentDate: result.payload.review_comment_date ?? null,
        reviewStatus: result.payload.review_status ?? "NOT_SUBMITTED",
        status: document?.status ?? "in_progress",
        updatedAt: document?.updated_at ?? new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid review action payload." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update the fieldwork tollgate review workflow." },
      { status: 400 },
    );
  }
}

async function safelyCreateNotification(callback: () => Promise<void>) {
  try {
    await callback();
  } catch (error) {
    console.error("Unable to create fieldwork tollgate review notification", error);
  }
}
