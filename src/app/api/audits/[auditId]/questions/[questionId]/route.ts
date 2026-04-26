import { NextResponse } from "next/server";
import { z } from "zod";

import { createNotificationForUserId } from "@/lib/audit-notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateQuestionSchema = z.object({
  dueDate: z.string().min(1).optional(),
  responseText: z.string().trim().min(1).optional(),
  status: z.enum(["OPEN", "RESPONDED", "OVERDUE"]).optional(),
});

type QuestionRecord = {
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

export async function PATCH(request: Request, context: { params: Promise<{ auditId: string; questionId: string }> }) {
  try {
    const { auditId, questionId } = await context.params;
    const body = updateQuestionSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const updatePayload: Record<string, string | null> = {};

    if (body.dueDate) {
      updatePayload.due_date = toDbDate(body.dueDate);
    }

    if (body.responseText) {
      updatePayload.response_text = body.responseText;
      updatePayload.response_date = toDbDate(new Date().toISOString());
      updatePayload.status = "responded";
    } else if (body.status) {
      updatePayload.status = body.status.toLowerCase();
    }

    const { data: updatedQuestion, error } = await supabase
      .from("questions")
      .update(updatePayload)
      .eq("audit_id", auditId)
      .eq("id", questionId)
      .select("id, control_id, asked_by_user_id, assigned_to, phase_tag, parent_question_id, parent_request_id, created_at, date_sent, due_date, status, question_text, response_text, response_date")
      .maybeSingle<QuestionRecord>();

    if (error) {
      throw new Error(error.message);
    }

    if (body.responseText && updatedQuestion?.asked_by_user_id) {
      await safelyCreateNotification(() =>
        createNotificationForUserId({
          auditId,
          detail: `A response was posted to: ${updatedQuestion.question_text}`,
          entityId: updatedQuestion.id,
          entityType: "question",
          eventType: "QUESTION_RESPONDED",
          linkHref: `/question-log?mode=live&auditId=${auditId}`,
          title: "A question you asked was answered",
          tone: "success",
          userId: updatedQuestion.asked_by_user_id!,
        }),
      );
    }

    return NextResponse.json(updatedQuestion);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid question update payload." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update question.",
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
    console.error("Unable to create question response notification", error);
  }
}
