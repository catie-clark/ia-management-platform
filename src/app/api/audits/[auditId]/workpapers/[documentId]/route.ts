import { NextResponse } from "next/server";
import { z } from "zod";

import { saveWorkpaperDraft } from "@/lib/fieldwork-workpaper-persistence";
import { getEmptyWorkpaperContent } from "@/lib/workpaper-content";

const workpaperContentSchema = z.object({
  conclusion: z.string(),
  nextSteps: z.string(),
  objective: z.string(),
  procedures: z.string(),
  results: z.string(),
  scope: z.string(),
  summary: z.string(),
});

const saveWorkpaperSchema = z.object({
  content: workpaperContentSchema,
});

export async function PATCH(request: Request, context: { params: Promise<{ auditId: string; documentId: string }> }) {
  try {
    const { auditId, documentId } = await context.params;
    const body = saveWorkpaperSchema.parse(await request.json());
    const result = await saveWorkpaperDraft({
      auditId,
      content: {
        ...getEmptyWorkpaperContent(),
        ...body.content,
      },
      documentId,
    });
    const payload = result.payload as Record<string, unknown>;

    return NextResponse.json({
      document: {
        documentId,
        previewSections: Array.isArray(payload.preview_sections) ? payload.preview_sections : [],
        previewSummary: typeof payload.preview_summary === "string" ? payload.preview_summary : "",
        reviewStatus: typeof payload.review_status === "string" ? payload.review_status : "NOT_SUBMITTED",
        status: result.data?.status ?? "in_progress",
        updatedAt: result.data?.updated_at ?? new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid workpaper payload." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to save the workpaper draft.",
      },
      { status: 400 },
    );
  }
}
