import { NextResponse } from "next/server";

import {
  chunkRows,
  getUploadFiles,
  hydrateImportRows,
  parseUploadFile,
  parseUploadMetadata,
  type ParsedUploadResult,
  toBatchParseError,
} from "@/lib/imports";
import { DEFAULT_COMPANY_NAME } from "@/lib/company";
import { insertManyRows, insertSingleRow } from "@/lib/supabase-rest";

type ImportBatchRecord = {
  id: string;
  audit_id: string | null;
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

    let totalRowCount = 0;
    const parseErrors: Array<{ fileName: string; fieldName: string; message: string }> = [];
    const parsedUploads: Array<{
      fieldName: (typeof uploadFiles)[number]["fieldName"];
      sourceEntity: (typeof uploadFiles)[number]["sourceEntity"];
      file: File;
      parsedUpload: ParsedUploadResult;
    }> = [];

    for (const uploadFile of uploadFiles) {
      try {
        const parsedUpload = await parseUploadFile(uploadFile.file, uploadFile.sourceEntity);
        parsedUploads.push({
          fieldName: uploadFile.fieldName,
          sourceEntity: uploadFile.sourceEntity,
          file: uploadFile.file,
          parsedUpload,
        });
        totalRowCount += parsedUpload.rowCount;
      } catch (error) {
        parseErrors.push(toBatchParseError(error, uploadFile.file.name, uploadFile.fieldName));
      }
    }

    if (parseErrors.length > 0 || parsedUploads.length === 0) {
      return NextResponse.json(
        {
          error:
            parsedUploads.length === 0
              ? "None of the uploaded files could be parsed."
              : "One or more uploaded files could not be parsed. Fix the import issues and try again.",
          parseErrors,
        },
        { status: 422 },
      );
    }

    const batch = await insertSingleRow<ImportBatchRecord>("import_batches", {
      audit_id: null,
      source_system: metadata.sourceSystem,
      uploaded_by: metadata.uploadedBy ?? null,
      original_file_name: `${metadata.auditName}.csv-upload`,
      archive_metadata: {
        auditName: metadata.auditName,
        companyName: DEFAULT_COMPANY_NAME,
        auditPeriodStart: metadata.auditPeriodStart,
        auditPeriodEnd: metadata.auditPeriodEnd,
        scopePeriodStart: metadata.scopePeriodStart,
        scopePeriodEnd: metadata.scopePeriodEnd,
        totalBudgetHours: metadata.totalBudgetHours,
        importSourceAuditId: metadata.importSourceAuditId ?? null,
        sourceSystem: metadata.sourceSystem,
        uploadedBy: metadata.uploadedBy ?? null,
        uploadFields: parsedUploads.map((file) => ({
          fieldName: file.fieldName,
          fileName: file.file.name,
          sourceEntity: file.sourceEntity,
          sheetName: file.parsedUpload.sheetName ?? null,
        })),
      },
      notes: `Parsed upload for ${metadata.auditName}`,
      status: "parsed",
      row_count: totalRowCount,
      parse_errors: [],
    });

    for (const uploadFile of parsedUploads) {
      const importFile = await insertSingleRow<ImportFileRecord>("import_files", {
        audit_id: null,
        import_batch_id: batch.id,
        source_entity: uploadFile.sourceEntity,
        file_name: uploadFile.file.name,
        sheet_name: uploadFile.parsedUpload.sheetName ?? null,
        file_sha256: null,
        row_count: uploadFile.parsedUpload.rowCount,
        header_row: uploadFile.parsedUpload.headers,
        parsed_at: new Date().toISOString(),
      });

      const hydratedRows = hydrateImportRows(importFile.id, uploadFile.parsedUpload.rawRows).map((row) => ({
        ...row,
        audit_id: null,
      }));

      for (const chunk of chunkRows(hydratedRows, 500)) {
        await insertManyRows("raw_import_rows", chunk);
      }
    }

    return NextResponse.json(
      {
        batchId: batch.id,
        status: "parsed",
        rowCount: totalRowCount,
        fileCount: parsedUploads.length,
        parseErrors: [],
      },
      { status: 201 },
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
