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
  scope_period_start?: string;
  scope_period_end?: string;
  total_budget_hours: number | null;
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
    const audit = await createAuditRecord(metadata);

    const batch = await insertSingleRow<ImportBatchRecord>("import_batches", {
      audit_id: audit.id,
      source_system: metadata.sourceSystem,
      uploaded_by: metadata.uploadedBy ?? null,
      original_file_name: `${metadata.auditName}.csv-upload`,
      archive_metadata: {
        auditName: metadata.auditName,
        auditPeriodStart: metadata.auditPeriodStart,
        auditPeriodEnd: metadata.auditPeriodEnd,
        scopePeriodStart: metadata.scopePeriodStart,
        scopePeriodEnd: metadata.scopePeriodEnd,
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
        periodStart: audit.scope_period_start ?? audit.period_start,
        periodEnd: audit.scope_period_end ?? audit.period_end,
        totalBudgetHours:
          audit.total_budget_hours === null || audit.total_budget_hours === undefined
            ? null
            : Number(audit.total_budget_hours),
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

async function createAuditRecord(metadata: ReturnType<typeof parseUploadMetadata>) {
  const basePayload = {
    name: metadata.auditName,
    period_start: metadata.auditPeriodStart,
    period_end: metadata.auditPeriodEnd,
    scope_period_start: metadata.scopePeriodStart,
    scope_period_end: metadata.scopePeriodEnd,
    source_system: metadata.sourceSystem,
    status: "active",
    active_phase: "Planning",
  };

  try {
    return await insertSingleRow<AuditRecord>("audits", {
      ...basePayload,
      total_budget_hours: metadata.totalBudgetHours,
    });
  } catch (error) {
    if (isMissingAuditColumnError(error, "total_budget_hours")) {
      try {
        return await insertSingleRow<AuditRecord>("audits", basePayload);
      } catch (nestedError) {
        if (!isMissingAuditColumnError(nestedError, "scope_period_start")) {
          throw nestedError;
        }

        return insertSingleRow<AuditRecord>("audits", {
          ...basePayload,
          scope_period_start: undefined,
          scope_period_end: undefined,
        });
      }
    }

    if (isMissingAuditColumnError(error, "scope_period_start")) {
      return insertSingleRow<AuditRecord>("audits", {
        name: metadata.auditName,
        period_start: metadata.auditPeriodStart,
        period_end: metadata.auditPeriodEnd,
        source_system: metadata.sourceSystem,
        status: "active",
        active_phase: "Planning",
        total_budget_hours: metadata.totalBudgetHours,
      });
    }

    throw error;
  }
}

function isMissingAuditColumnError(error: unknown, columnName: string) {
  return error instanceof Error && error.message.includes(columnName);
}
