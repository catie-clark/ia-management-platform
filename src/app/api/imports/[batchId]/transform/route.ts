import { NextResponse } from "next/server";
import { z } from "zod";

import { transformImportBatch } from "@/lib/import-transform";

const batchIdSchema = z.string().uuid("Batch id must be a valid UUID.");

export async function POST(_: Request, context: { params: Promise<{ batchId: string }> }) {
  try {
    const { batchId } = await context.params;
    const parsedBatchId = batchIdSchema.parse(batchId);
    const summary = await transformImportBatch(parsedBatchId);

    return NextResponse.json(
      {
        batchId: parsedBatchId,
        status: "loaded",
        summary,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Batch transform failed.",
      },
      { status: 400 },
    );
  }
}
