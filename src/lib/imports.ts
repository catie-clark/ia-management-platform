import { z } from "zod";

import { DEFAULT_COMPANY_NAME } from "@/lib/company";
import { parseCsvDocument } from "@/lib/csv";

export const uploadFieldNames = [
  "controls",
  "questions",
  "requests",
  "applications",
  "users",
  "thirdParties",
  "risks",
  "riskControlLinks",
  "rcsaRecords",
  "issues",
  "monitoringResults",
  "priorAuditFindings",
] as const;

export type UploadFieldName = (typeof uploadFieldNames)[number];

export type SourceEntity =
  | "applications"
  | "users"
  | "third_parties"
  | "controls"
  | "risks"
  | "risk_control_links"
  | "rcsa_records"
  | "issues"
  | "monitoring_results"
  | "prior_audit_findings"
  | "questions"
  | "requests"
  | "documents";

const sourceEntitySchema = z.enum([
  "applications",
  "users",
  "third_parties",
  "controls",
  "risks",
  "risk_control_links",
  "rcsa_records",
  "issues",
  "monitoring_results",
  "prior_audit_findings",
  "questions",
  "requests",
  "documents",
]);

const uploadMetadataSchema = z.object({
  auditName: z.string().trim().min(1, "Audit name is required."),
  auditPeriodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Audit period start must use YYYY-MM-DD."),
  auditPeriodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Audit period end must use YYYY-MM-DD."),
  scopePeriodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Scope period start must use YYYY-MM-DD."),
  scopePeriodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Scope period end must use YYYY-MM-DD."),
  importSourceAuditId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .pipe(z.string().uuid().optional()),
  totalBudgetHours: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  sourceSystem: z.string().trim().min(1).default("archer"),
  uploadedBy: z.string().uuid().optional(),
});

type UploadFileDescriptor = {
  fieldName: UploadFieldName;
  file: File;
  sourceEntity: SourceEntity;
};

type ParseError = {
  fileName: string;
  fieldName: UploadFieldName;
  message: string;
};

type RawImportRowInsert = {
  import_file_id: string;
  audit_id?: string | null;
  row_number: number;
  source_record_key: string | null;
  raw_payload: Record<string, string | null>;
  validation_status: string;
  validation_errors: unknown[];
};

export function parseUploadMetadata(formData: FormData) {
  const parsed = uploadMetadataSchema.safeParse({
    auditName: formData.get("auditName"),
    auditPeriodStart: formData.get("auditPeriodStart") ?? formData.get("periodStart"),
    auditPeriodEnd: formData.get("auditPeriodEnd") ?? formData.get("periodEnd"),
    scopePeriodStart: formData.get("scopePeriodStart") ?? formData.get("periodStart"),
    scopePeriodEnd: formData.get("scopePeriodEnd") ?? formData.get("periodEnd"),
    importSourceAuditId: formData.get("importSourceAuditId") ?? undefined,
    totalBudgetHours: formData.get("totalBudgetHours") ?? undefined,
    sourceSystem: formData.get("sourceSystem") ?? "archer",
    uploadedBy: formData.get("uploadedBy") ?? undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Upload metadata is invalid.");
  }

  if (parsed.data.auditPeriodStart > parsed.data.auditPeriodEnd) {
    throw new Error("Audit period end must be the same as or later than the start date.");
  }

  if (parsed.data.scopePeriodStart > parsed.data.scopePeriodEnd) {
    throw new Error("Scope period end must be the same as or later than the start date.");
  }

  const totalBudgetHours =
    parsed.data.totalBudgetHours === undefined ? null : Number(parsed.data.totalBudgetHours);

  if (totalBudgetHours !== null && (!Number.isFinite(totalBudgetHours) || totalBudgetHours < 0)) {
    throw new Error("Total audit hours must be a non-negative number.");
  }

  return {
    ...parsed.data,
    companyName: DEFAULT_COMPANY_NAME,
    totalBudgetHours,
  };
}

export function getUploadFiles(formData: FormData): UploadFileDescriptor[] {
  const files = uploadFieldNames.flatMap((fieldName) => {
    const entry = formData.get(fieldName);

    if (!(entry instanceof File) || entry.size === 0) {
      return [];
    }

    const explicitSourceEntity = formData.get(`sourceEntity_${fieldName}`);
    const sourceEntity = sourceEntitySchema.parse(explicitSourceEntity ?? defaultSourceEntityMap[fieldName]);

    return [{ fieldName, file: entry, sourceEntity }];
  });

  const requiredFields = uploadFieldNames.filter((fieldName) => {
    if (fieldName === "controls") {
      return true;
    }

    return fieldName === "riskControlLinks" && files.some((file) => file.fieldName === "risks");
  });

  for (const fieldName of requiredFields) {
    if (!files.find((file) => file.fieldName === fieldName)) {
      throw new Error(`Missing required upload: ${fieldName}.`);
    }
  }

  return files;
}

export async function parseCsvUpload(file: File) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new Error("Only .csv uploads are supported by this route right now.");
  }

  const parsed = parseCsvDocument(await file.text());
  const rawRows = parsed.rows.map((row, rowIndex) => buildRawImportRowPayload(row, parsed.headers, rowIndex + 2));

  return {
    headers: parsed.headers,
    rawRows,
    rowCount: rawRows.length,
  };
}

export function toBatchParseError(error: unknown, fileName: string, fieldName: UploadFieldName): ParseError {
  return {
    fileName,
    fieldName,
    message: error instanceof Error ? error.message : "Unknown parsing error.",
  };
}

export function chunkRows<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

export function hydrateImportRows(importFileId: string, rows: RawImportRowInsert[]) {
  return rows.map((row) => ({
    ...row,
    import_file_id: importFileId,
  }));
}

export type ParsedUploadResult = Awaited<ReturnType<typeof parseCsvUpload>>;
export type ImportParseError = ParseError;

const defaultSourceEntityMap: Record<UploadFieldName, SourceEntity> = {
  controls: "controls",
  questions: "questions",
  requests: "requests",
  applications: "applications",
  users: "users",
  thirdParties: "third_parties",
  risks: "risks",
  riskControlLinks: "risk_control_links",
  rcsaRecords: "rcsa_records",
  issues: "issues",
  monitoringResults: "monitoring_results",
  priorAuditFindings: "prior_audit_findings",
};

function buildRawImportRowPayload(row: string[], headers: string[], rowNumber: number): RawImportRowInsert {
  const rawPayload = headers.reduce<Record<string, string | null>>((accumulator, header, index) => {
    const value = row[index] ?? "";
    accumulator[header] = value.trim().length === 0 ? null : value;
    return accumulator;
  }, {});

  return {
    import_file_id: "",
    row_number: rowNumber,
    source_record_key: deriveSourceRecordKey(rawPayload),
    raw_payload: rawPayload,
    validation_status: "pending",
    validation_errors: [],
  };
}

function deriveSourceRecordKey(rawPayload: Record<string, string | null>) {
  const match = Object.entries(rawPayload).find(([header, value]) => {
    if (!value) {
      return false;
    }

    const normalizedHeader = header.replace(/[\s_]+/g, "").toLowerCase();
    return (
      normalizedHeader === "id" ||
      normalizedHeader === "controlid" ||
      normalizedHeader === "recordid" ||
      normalizedHeader === "sourcerecordkey" ||
      normalizedHeader.endsWith("id")
    );
  });

  return match?.[1] ?? null;
}
