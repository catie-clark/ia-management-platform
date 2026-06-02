import { NextResponse } from "next/server";
import { z } from "zod";

import { createReviewNote, loadDocumentReviewNotes } from "@/lib/review-notes-persistence";

const createNoteSchema = z.object({
  note: z.string().trim().min(1, "A review note is required."),
  createdByUserId: z.string().uuid().optional(),
  createdByName: z.string().trim().min(1).default("Reviewer"),
  assignedToUserId: z.string().uuid().optional(),
  assignedToName: z.string().trim().optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ auditId: string; documentId: string }> }) {
  try {
    const { auditId, documentId } = await context.params;
    const notes = await loadDocumentReviewNotes(auditId, documentId);
    return NextResponse.json({ notes });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load review notes." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request, context: { params: Promise<{ auditId: string; documentId: string }> }) {
  try {
    const { auditId, documentId } = await context.params;
    const body = createNoteSchema.parse(await request.json());

    const note = await createReviewNote({
      auditId,
      documentId,
      note: body.note,
      createdByUserId: body.createdByUserId,
      createdByName: body.createdByName,
      assignedToUserId: body.assignedToUserId,
      assignedToName: body.assignedToName,
    });

    const notes = await loadDocumentReviewNotes(auditId, documentId);
    return NextResponse.json({ note, notes });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid review note payload." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create the review note." },
      { status: 400 },
    );
  }
}
