import { NextResponse } from "next/server";
import { z } from "zod";

import { createNotificationForStakeholderName } from "@/lib/audit-notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createRequestSchema = z.object({
  assignedTo: z.string().trim().min(1),
  controlId: z.string().trim().min(1),
  description: z.string().trim().min(1),
  dueDate: z.string().min(1),
  phaseTag: z.enum(["Planning", "Fieldwork", "Reporting"]),
  parentQuestionId: z.string().uuid().optional(),
  parentRequestId: z.string().uuid().optional(),
}).refine((value) => !(value.parentQuestionId && value.parentRequestId), {
  message: "A follow-up can reference either a question or a request, but not both.",
  path: ["parentQuestionId"],
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

export async function POST(request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const body = createRequestSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const { data: createdRequest, error } = await supabase
      .from("requests")
      .insert({
        audit_id: auditId,
        source_system: "manual",
        source_record_key: `manual-request-${crypto.randomUUID()}`,
        control_id: body.controlId,
        phase_tag: body.phaseTag,
        parent_question_id: body.parentQuestionId ?? null,
        parent_request_id: body.parentRequestId ?? null,
        description: body.description,
        requested_from: body.assignedTo,
        date_requested: toDbDate(new Date().toISOString()),
        due_date: toDbDate(body.dueDate),
        status: "open",
        response_notes: null,
        source_payload: {
          created_in_app: true,
        },
      })
      .select("id, control_id, phase_tag, parent_question_id, parent_request_id, created_at, completed_at, description, requested_from, date_requested, due_date, status, response_notes")
      .maybeSingle<RequestRecord>();

    if (error) {
      throw new Error(error.message);
    }

    if (createdRequest) {
      await safelyCreateNotification(() =>
        createNotificationForStakeholderName({
          auditId,
          detail: createdRequest.description,
          entityId: createdRequest.id,
          entityType: "request",
          eventType: "REQUEST_ASSIGNED",
          linkHref: `/question-log?mode=live&auditId=${auditId}`,
          stakeholderName: createdRequest.requested_from,
          title: "You were tagged on a request",
          tone: "warning",
        }),
      );
    }

    return NextResponse.json(createdRequest, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request payload." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create request.",
      },
      { status: 400 },
    );
  }
}

function toDbDate(value: string) {
  return value.slice(0, 10);
}

async function safelyCreateNotification(callback: () => Promise<void>) {
  try {
    await callback();
  } catch (error) {
    console.error("Unable to create request notification", error);
  }
}
