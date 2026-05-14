import { NextResponse } from "next/server";
import { z } from "zod";

import { loadControlTestingMatrix, saveControlTestingMatrix } from "@/lib/control-testing-matrix-persistence";
import { syncWorkpaperFromTestingMatrix } from "@/lib/fieldwork-workpaper-persistence";

const testingMatrixResultSchema = z.enum(["PASS", "FAIL", "NOT_TESTED"]);

const testingMatrixAttributeSchema = z.object({
  id: z.string().uuid().optional(),
  attributeKey: z.string().optional(),
  label: z.string(),
  guidance: z.string(),
  displayOrder: z.number().int().nonnegative(),
});

const testingMatrixSampleSchema = z.object({
  id: z.string().uuid().optional(),
  sampleIdentifier: z.string(),
  sampleDescription: z.string(),
  sourceReference: z.string(),
  exceptionNoted: z.string(),
  displayOrder: z.number().int().nonnegative(),
});

const testingMatrixRowResultSchema = z.object({
  id: z.string().uuid().optional(),
  sampleId: z.string(),
  attributeId: z.string(),
  result: testingMatrixResultSchema,
});

const testingMatrixSaveSchema = z.object({
  auditId: z.string().uuid(),
  matrix: z.object({
    title: z.string(),
    populationDescription: z.string(),
    populationSize: z.number().int().nonnegative().nullable().optional(),
    sampleDescription: z.string(),
    sampleSize: z.number().int().nonnegative().nullable().optional(),
    conclusion: z.string(),
    attributes: z.array(testingMatrixAttributeSchema),
    samples: z.array(testingMatrixSampleSchema),
    results: z.array(testingMatrixRowResultSchema),
  }),
});

export async function GET(request: Request, context: { params: Promise<{ controlId: string }> }) {
  try {
    const { controlId } = await context.params;
    const { searchParams } = new URL(request.url);
    const auditId = searchParams.get("auditId");

    if (!auditId) {
      return NextResponse.json({ error: "auditId is required." }, { status: 400 });
    }

    const matrix = await loadControlTestingMatrix(auditId, controlId);

    if (!matrix) {
      return NextResponse.json({ error: "The testing matrix was not found." }, { status: 404 });
    }

    return NextResponse.json({ matrix });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load the testing matrix.",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ controlId: string }> }) {
  try {
    const { controlId } = await context.params;
    const body = testingMatrixSaveSchema.parse(await request.json());
    const matrix = await saveControlTestingMatrix({
      auditId: body.auditId,
      controlId,
      matrix: {
        title: body.matrix.title,
        populationDescription: body.matrix.populationDescription,
        populationSize: body.matrix.populationSize ?? undefined,
        sampleDescription: body.matrix.sampleDescription,
        sampleSize: body.matrix.sampleSize ?? undefined,
        conclusion: body.matrix.conclusion,
        attributes: body.matrix.attributes,
        samples: body.matrix.samples,
        results: body.matrix.results,
      },
    });
    await syncWorkpaperFromTestingMatrix({
      auditId: body.auditId,
      controlId,
      matrix,
    });

    return NextResponse.json({ matrix });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid testing matrix payload." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to save the testing matrix.",
      },
      { status: 400 },
    );
  }
}
