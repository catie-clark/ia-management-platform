import { NextResponse } from "next/server";
import { z } from "zod";

import { loadControlTestingMatricesForControl } from "@/lib/control-testing-matrix-persistence";
import { generateAuditText, isAiConfigured } from "@/lib/ai/anthropic";
import {
  TEST_RESULT_NARRATIVE_SYSTEM,
  buildNarrativePrompt,
  buildTemplateNarrative,
  summarizeControlMatrices,
} from "@/lib/test-result-narrative";

const draftSchema = z.object({
  controlId: z.string().uuid(),
  controlLabel: z.string().trim().default("Control"),
  controlName: z.string().trim().default("the control"),
  controlDescription: z.string().trim().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ auditId: string; documentId: string }> }) {
  try {
    const { auditId } = await context.params;
    const body = draftSchema.parse(await request.json());

    const matrices = await loadControlTestingMatricesForControl(auditId, body.controlId);
    const summary = summarizeControlMatrices(matrices);

    if (summary.sampleCount === 0) {
      return NextResponse.json(
        { error: "Add sample items and record results before drafting a test result narrative." },
        { status: 400 },
      );
    }

    if (!isAiConfigured()) {
      return NextResponse.json({
        narrative: buildTemplateNarrative({ controlName: body.controlName, summary }),
        source: "template",
      });
    }

    try {
      const narrative = await generateAuditText({
        system: TEST_RESULT_NARRATIVE_SYSTEM,
        prompt: buildNarrativePrompt({
          controlLabel: body.controlLabel,
          controlName: body.controlName,
          controlDescription: body.controlDescription,
          summary,
        }),
        maxTokens: 6000,
      });

      return NextResponse.json({
        narrative: narrative || buildTemplateNarrative({ controlName: body.controlName, summary }),
        source: narrative ? "ai" : "template",
      });
    } catch {
      // Fall back to the deterministic template if the model call fails.
      return NextResponse.json({
        narrative: buildTemplateNarrative({ controlName: body.controlName, summary }),
        source: "template",
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to draft the test result narrative." },
      { status: 400 },
    );
  }
}
