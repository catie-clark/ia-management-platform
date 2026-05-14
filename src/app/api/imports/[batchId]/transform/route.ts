import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureStandardAuditDocuments } from "@/lib/audit-document-seeding";
import {
  attachAuditToImportBatch,
  createAuditRecordFromArchiveMetadata,
  rollbackImportedAudit,
} from "@/lib/import-audit";
import { transformImportBatch } from "@/lib/import-transform";
import { supabaseRestRequest } from "@/lib/supabase-rest";

const batchIdSchema = z.string().uuid("Batch id must be a valid UUID.");

type ImportBatchTransformRecord = {
  id: string;
  audit_id: string | null;
  archive_metadata: Record<string, unknown>;
};

export async function POST(_: Request, context: { params: Promise<{ batchId: string }> }) {
  let createdAuditId: string | null = null;
  let parsedBatchId = "";

  try {
    const { batchId } = await context.params;
    parsedBatchId = batchIdSchema.parse(batchId);
    const batches = await supabaseRestRequest<ImportBatchTransformRecord[]>(
      `import_batches?id=eq.${encodeURIComponent(parsedBatchId)}&select=id,audit_id,archive_metadata&limit=1`,
    );
    const [batch] = batches;

    if (!batch) {
      return NextResponse.json({ error: "Import batch not found." }, { status: 404 });
    }

    if (!batch.audit_id) {
      const audit = await createAuditRecordFromArchiveMetadata(batch.archive_metadata);
      createdAuditId = audit.id;
      await ensureStandardAuditDocuments({ auditId: audit.id, auditName: audit.name });
      await attachAuditToImportBatch(parsedBatchId, audit.id);
    }

    const summary = await transformImportBatch(parsedBatchId);

    return NextResponse.json(
      {
        batchId: parsedBatchId,
        auditId: createdAuditId ?? batch.audit_id,
        status: "loaded",
        summary,
      },
      { status: 200 },
    );
  } catch (error) {
    if (createdAuditId && parsedBatchId) {
      try {
        await rollbackImportedAudit(parsedBatchId, createdAuditId);
      } catch (rollbackError) {
        console.error("Failed to roll back audit after import transform failure.", rollbackError);
      }
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Batch transform failed.",
      },
      { status: 400 },
    );
  }
}
