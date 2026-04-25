import { NextResponse } from "next/server";

import {
  chunkRows,
  getUploadFiles,
  hydrateImportRows,
  parseCsvUpload,
  parseUploadMetadata,
  toBatchParseError,
} from "@/lib/imports";
import { insertManyRows, insertSingleRow, patchRows } from "@/lib/supabase-rest";

type AuditRecord = {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
};

type ImportBatchRecord = {
  id: string;
  audit_id: string;
  status: string;
  row_count: number;
  parse_errors: unknown[];
};

type ImportFileRecord = {
  id: string;
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const metadata = parseUploadMetadata(formData);
    const uploadFiles = getUploadFiles(formData);
    const audit = await insertSingleRow<AuditRecord>("audits", {
      name: metadata.auditName,
      period_start: metadata.periodStart,
      period_end: metadata.periodEnd,
      source_system: metadata.sourceSystem,
      status: "active",
      active_phase: "Planning",
    });

    const batch = await insertSingleRow<ImportBatchRecord>("import_batches", {
      audit_id: audit.id,
      source_system: metadata.sourceSystem,
      uploaded_by: metadata.uploadedBy ?? null,
      original_file_name: `${metadata.auditName}.csv-upload`,
      archive_metadata: {
        auditName: metadata.auditName,
        periodStart: metadata.periodStart,
        periodEnd: metadata.periodEnd,
        uploadFields: uploadFiles.map((file) => ({
          fieldName: file.fieldName,
          fileName: file.file.name,
          sourceEntity: file.sourceEntity,
        })),
      },
      notes: `Audit upload for ${metadata.auditName}`,
      status: "uploaded",
    });

    let totalRowCount = 0;
    let successfulFileCount = 0;
    const parseErrors: Array<{ fileName: string; fieldName: string; message: string }> = [];

    for (const uploadFile of uploadFiles) {
      try {
        const parsedUpload = await parseCsvUpload(uploadFile.file);
        const importFile = await insertSingleRow<ImportFileRecord>("import_files", {
          audit_id: audit.id,
          import_batch_id: batch.id,
          source_entity: uploadFile.sourceEntity,
          file_name: uploadFile.file.name,
          file_sha256: null,
          row_count: parsedUpload.rowCount,
          header_row: parsedUpload.headers,
          parsed_at: new Date().toISOString(),
        });

        const hydratedRows = hydrateImportRows(importFile.id, parsedUpload.rawRows).map((row) => ({
          ...row,
          audit_id: audit.id,
        }));

        for (const chunk of chunkRows(hydratedRows, 500)) {
          await insertManyRows("raw_import_rows", chunk);
        }

        totalRowCount += parsedUpload.rowCount;
        successfulFileCount += 1;
      } catch (error) {
        parseErrors.push(toBatchParseError(error, uploadFile.file.name, uploadFile.fieldName));
      }
    }

    const nextStatus = parseErrors.length > 0 ? "failed" : "parsed";

    await patchRows(`import_batches?id=eq.${batch.id}`, {
      status: nextStatus,
      row_count: totalRowCount,
      parse_errors: parseErrors,
    });

    if (successfulFileCount === 0) {
      return NextResponse.json(
        {
          error: "None of the uploaded files could be parsed.",
          auditId: audit.id,
          batchId: batch.id,
          parseErrors,
        },
        { status: 422 },
      );
    }

    return NextResponse.json(
        {
        auditId: audit.id,
        batchId: batch.id,
        auditName: audit.name,
        periodStart: audit.period_start,
        periodEnd: audit.period_end,
        status: nextStatus,
        rowCount: totalRowCount,
        fileCount: successfulFileCount,
        parseErrors,
      },
      { status: parseErrors.length > 0 ? 207 : 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Upload failed.",
      },
      { status: 400 },
    );
  }
}
