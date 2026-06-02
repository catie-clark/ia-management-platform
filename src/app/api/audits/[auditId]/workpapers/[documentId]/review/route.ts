import { NextResponse } from "next/server";
import { z } from "zod";

import { createNotificationForUserId, createNotificationsForRole } from "@/lib/audit-notifications";
import { applyWorkpaperReviewAction } from "@/lib/fieldwork-workpaper-persistence";
import { countOpenNotesForDocument } from "@/lib/review-notes-persistence";
import { getEmptyWorkpaperContent } from "@/lib/workpaper-content";

const workpaperContentSchema = z.object({
  controlReference: z.string(),
  keyControl: z.string(),
  typeOfControl: z.string(),
  controlFrequency: z.string(),
  assertions: z.string(),
  descriptionOfTestToBePerformed: z.string(),
  totalPopulationAndSamplingUnits: z.string(),
  populationCompletenessConsideration: z.string(),
  sampleSizeAndSelectionProcedures: z.string(),
  expectedDeviationTypes: z.string(),
  documentationOfTesting: z.string(),
  extensionOfInterimTestingToEndOfPeriod: z.string(),
  matrixExceptionSummary: z.string(),
  numberOfDeviationsDetected: z.string(),
  deviationDescriptionAndCause: z.string(),
  didDeviationsResultFromFraudOrError: z.string(),
  wereDeviationsIsolatedOrPervasive: z.string(),
  finalNumberOfDeviations: z.string(),
  controlEffectivenessConclusion: z.string(),
});

// Send-back rationale now lives in review notes (one or more threads), so the
// workpaper review action no longer carries a single comment.
const reviewActionSchema = z.object({
  action: z.enum(["approve", "send_back", "send_to_review"]),
  actingRole: z.enum(["AIC", "STAFF", "MANAGER", "DIRECTOR", "CAE"]),
  actingUserName: z.string().min(1),
  content: workpaperContentSchema.optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ auditId: string; documentId: string }> }) {
  try {
    const { auditId, documentId } = await context.params;
    const body = reviewActionSchema.parse(await request.json());

    if (body.action === "send_back") {
      const openNotes = await countOpenNotesForDocument(auditId, documentId);
      if (openNotes === 0) {
        return NextResponse.json(
          { error: "Add at least one review note before sending the workpaper back." },
          { status: 400 },
        );
      }
    }

    const result = await applyWorkpaperReviewAction({
      action: body.action,
      actingRole: body.actingRole,
      actingUserName: body.actingUserName,
      auditId,
      content: body.content
        ? {
            ...getEmptyWorkpaperContent(),
            ...body.content,
          }
        : undefined,
      documentId,
    });
    const nextReviewStatus = typeof result.payload.review_status === "string" ? result.payload.review_status : "NOT_SUBMITTED";

    await safelyCreateNotification(async () => {
      if (body.action === "send_to_review") {
        await createNotificationsForRole({
          auditId,
          detail: `${result.data?.title ?? "Workpaper"} is waiting for AIC review.`,
          entityId: documentId,
          entityType: "workpaper",
          eventType: "WORKPAPER_AIC_REVIEW",
          linkHref: `/fieldwork?mode=live&auditId=${auditId}`,
          role: "AIC",
          title: "A workpaper is ready for AIC review",
          tone: "warning",
        });
        return;
      }

      if (body.action === "send_back") {
        if (result.data?.owner_user_id) {
          await createNotificationForUserId({
            auditId,
            detail: `${result.data?.title ?? "Workpaper"} was sent back with review notes to address.`,
            entityId: documentId,
            entityType: "workpaper",
            eventType: "WORKPAPER_SENT_BACK",
            linkHref: `/fieldwork?mode=live&auditId=${auditId}`,
            title: "A workpaper was sent back to you",
            tone: "warning",
            userId: result.data.owner_user_id,
          });
        }
        return;
      }

      if (nextReviewStatus === "MANAGER_REVIEW") {
        await createNotificationsForRole({
          auditId,
          detail: `${result.data?.title ?? "Workpaper"} is waiting for manager review.`,
          entityId: documentId,
          entityType: "workpaper",
          eventType: "WORKPAPER_MANAGER_REVIEW",
          linkHref: `/fieldwork?mode=live&auditId=${auditId}`,
          role: "MANAGER",
          title: "A workpaper is ready for manager review",
          tone: "warning",
        });
        return;
      }

      if (nextReviewStatus === "DIRECTOR_REVIEW") {
        await createNotificationsForRole({
          auditId,
          detail: `${result.data?.title ?? "Workpaper"} is waiting for director review.`,
          entityId: documentId,
          entityType: "workpaper",
          eventType: "WORKPAPER_DIRECTOR_REVIEW",
          linkHref: `/fieldwork?mode=live&auditId=${auditId}`,
          role: "DIRECTOR",
          title: "A workpaper is ready for director review",
          tone: "warning",
        });
        return;
      }

      if (nextReviewStatus === "APPROVED" && result.data?.owner_user_id) {
        await createNotificationForUserId({
          auditId,
          detail: `${result.data?.title ?? "Workpaper"} completed the review workflow.`,
          entityId: documentId,
          entityType: "workpaper",
          eventType: "WORKPAPER_APPROVED",
          linkHref: `/fieldwork?mode=live&auditId=${auditId}`,
          title: "Your workpaper was approved",
          tone: "success",
          userId: result.data.owner_user_id,
        });
      }
    });

    return NextResponse.json({
      document: {
        documentId,
        reviewStatus: result.payload.review_status ?? "NOT_SUBMITTED",
        status: result.data?.status ?? "in_progress",
        updatedAt: result.data?.updated_at ?? new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid review action payload." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update the workpaper review workflow.",
      },
      { status: 400 },
    );
  }
}

async function safelyCreateNotification(callback: () => Promise<void>) {
  try {
    await callback();
  } catch (error) {
    console.error("Unable to create workpaper review notification", error);
  }
}
