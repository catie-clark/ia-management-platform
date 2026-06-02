import { NextResponse } from "next/server";
import { z } from "zod";

import { applyReviewNoteAction, loadDocumentReviewNotes } from "@/lib/review-notes-persistence";

const actionSchema = z.object({
  action: z.enum(["reply", "clear", "reopen", "close"]),
  actorName: z.string().trim().min(1).default("Audit user"),
  actorUserId: z.string().uuid().optional(),
  comment: z.string().trim().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ auditId: string; documentId: string; noteId: string }> },
) {
  try {
    const { auditId, documentId, noteId } = await context.params;
    const body = actionSchema.parse(await request.json());

    if (body.action === "reply" && (!body.comment || body.comment.length === 0)) {
      return NextResponse.json({ error: "A reply message is required." }, { status: 400 });
    }

    const note = await applyReviewNoteAction({
      auditId,
      noteId,
      action: body.action,
      actorName: body.actorName,
      actorUserId: body.actorUserId,
      comment: body.comment,
    });

    const notes = await loadDocumentReviewNotes(auditId, documentId);
    return NextResponse.json({ note, notes });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid review note action." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update the review note." },
      { status: 400 },
    );
  }
}
