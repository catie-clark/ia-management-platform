import { NextResponse } from "next/server";
import { z } from "zod";

import { createNotificationForUserId } from "@/lib/audit-notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateRequestSchema = z.object({
  responseNotes: z.string().trim().min(1).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED"]).optional(),
});

type RequestRecord = {
  control_id: string | null;
  created_at?: string | null;
  completed_at?: string | null;
  date_requested: string | null;
  description: string;
  due_date: string | null;
  id: string;
  parent_question_id?: string | null;
  parent_request_id?: string | null;
  phase_tag?: string | null;
  requested_from: string;
  response_notes: string | null;
  status: string;
};

export async function PATCH(request: Request, context: { params: Promise<{ auditId: string; requestId: string }> }) {
  try {
    const { auditId, requestId } = await context.params;
    const body = updateRequestSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const updatePayload: Record<string, string | null> = {};

    if (body.responseNotes) {
      updatePayload.response_notes = body.responseNotes;
      updatePayload.status = body.status?.toLowerCase() ?? "completed";
      updatePayload.completed_at = new Date().toISOString();
    } else if (body.status) {
      updatePayload.status = body.status.toLowerCase();
      updatePayload.completed_at = body.status === "COMPLETED" ? new Date().toISOString() : null;
    }

    const { data: updatedRequest, error } = await supabase
      .from("requests")
      .update(updatePayload)
      .eq("audit_id", auditId)
      .eq("id", requestId)
      .select("id, control_id, phase_tag, parent_question_id, parent_request_id, created_at, completed_at, description, requested_from, date_requested, due_date, status, response_notes")
      .maybeSingle<RequestRecord>();

    if (error) {
      throw new Error(error.message);
    }

    if (updatedRequest && (body.responseNotes || body.status === "COMPLETED") && updatedRequest.control_id) {
      const { data: controlOwner, error: controlLookupError } = await supabase
        .from("controls")
        .select("assigned_owner_user_id, control_owner_user_id")
        .eq("id", updatedRequest.control_id)
        .maybeSingle<{ assigned_owner_user_id: string | null; control_owner_user_id: string | null }>();

      if (controlLookupError) {
        throw new Error(controlLookupError.message);
      }

      const ownerUserId = controlOwner?.assigned_owner_user_id ?? controlOwner?.control_owner_user_id ?? null;

      if (ownerUserId) {
        await safelyCreateNotification(() =>
          createNotificationForUserId({
            auditId,
            detail: `${updatedRequest.description} was marked complete.`,
            entityId: updatedRequest.id,
            entityType: "request",
            eventType: "REQUEST_COMPLETED",
            linkHref: `/question-log?mode=live&auditId=${auditId}`,
            title: "A request linked to your audit work was fulfilled",
            tone: "success",
            userId: ownerUserId,
          }),
        );
      }
    }

    return NextResponse.json(updatedRequest);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request update payload." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update request.",
      },
      { status: 400 },
    );
  }
}

async function safelyCreateNotification(callback: () => Promise<void>) {
  try {
    await callback();
  } catch (error) {
    console.error("Unable to create request completion notification", error);
  }
}
