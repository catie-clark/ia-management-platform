import { NextResponse } from "next/server";
import { z } from "zod";

import { createNotificationForStakeholderName } from "@/lib/audit-notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createQuestionSchema = z.object({
  askedByUserId: z.string().min(1),
  assignedTo: z.string().trim().min(1),
  controlId: z.string().trim().min(1),
  dueDate: z.string().min(1),
  phaseTag: z.enum(["Planning", "Fieldwork", "Reporting"]),
  parentQuestionId: z.string().uuid().optional(),
  parentRequestId: z.string().uuid().optional(),
  questionText: z.string().trim().min(1),
}).refine((value) => !(value.parentQuestionId && value.parentRequestId), {
  message: "A follow-up can reference either a question or a request, but not both.",
  path: ["parentQuestionId"],
});

type QuestionRecord = {
  audit_id?: string | null;
  asked_by_user_id: string | null;
  assigned_to: string;
  control_id: string | null;
  created_at?: string | null;
  date_sent: string | null;
  due_date: string | null;
  id: string;
  parent_question_id?: string | null;
  parent_request_id?: string | null;
  phase_tag?: string | null;
  question_text: string;
  response_date: string | null;
  response_text: string | null;
  status: string;
};

export async function POST(request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const body = createQuestionSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const sourceRecordKey = `manual-question-${crypto.randomUUID()}`;
    const dateSent = toDbDate(new Date().toISOString());
    const dueDate = toDbDate(body.dueDate);
    const { data: createdQuestion, error } = await supabase
      .from("questions")
      .insert({
        audit_id: auditId,
        source_system: "manual",
        source_record_key: sourceRecordKey,
        control_id: body.controlId,
        asked_by_user_id: body.askedByUserId,
        assigned_to: body.assignedTo,
        phase_tag: body.phaseTag,
        parent_question_id: body.parentQuestionId ?? null,
        parent_request_id: body.parentRequestId ?? null,
        date_sent: dateSent,
        due_date: dueDate,
        status: "open",
        question_text: body.questionText,
        response_text: null,
        response_date: null,
        source_payload: {
          created_in_app: true,
        },
      })
      .select("id, control_id, asked_by_user_id, assigned_to, phase_tag, parent_question_id, parent_request_id, created_at, date_sent, due_date, status, question_text, response_text, response_date")
      .maybeSingle<QuestionRecord>();

    if (error) {
      throw new Error(error.message);
    }

    if (createdQuestion) {
      await safelyCreateNotification(() =>
        createNotificationForStakeholderName({
          auditId,
          detail: createdQuestion.question_text,
          entityId: createdQuestion.id,
          entityType: "question",
          eventType: "QUESTION_ASSIGNED",
          linkHref: `/question-log?mode=live&auditId=${auditId}`,
          stakeholderName: createdQuestion.assigned_to,
          title: "You were tagged on a question",
          tone: "warning",
        }),
      );
    }

    return NextResponse.json(createdQuestion, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid question payload." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create question.",
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
    console.error("Unable to create question notification", error);
  }
}
