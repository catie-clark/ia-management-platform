import { z } from "zod";

import { DEFAULT_COMPANY_NAME } from "@/lib/company";
import { deleteRows, insertSingleRow, patchRows, supabaseRestRequest } from "@/lib/supabase-rest";

type AuditRecord = {
  id: string;
  name: string;
  company_name?: string | null;
  period_start: string;
  period_end: string;
  scope_period_start?: string;
  scope_period_end?: string;
  total_budget_hours: number | null;
  planning_budget_hours?: number | null;
  fieldwork_budget_hours?: number | null;
  reporting_budget_hours?: number | null;
};

const importArchiveMetadataSchema = z.object({
  auditName: z.string().trim().min(1),
  auditPeriodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  auditPeriodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scopePeriodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scopePeriodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  importSourceAuditId: z.string().uuid().nullable().optional(),
  totalBudgetHours: z.number().nullable().optional(),
  sourceSystem: z.string().trim().min(1).default("archer"),
  uploadedBy: z.string().uuid().nullable().optional(),
});

type CreateAuditMetadata = z.infer<typeof importArchiveMetadataSchema>;

type SourceBudgetDefaults = {
  total_budget_hours: number | null;
  planning_budget_hours: number | null;
  fieldwork_budget_hours: number | null;
  reporting_budget_hours: number | null;
};

export function parseImportArchiveMetadata(archiveMetadata: Record<string, unknown>) {
  const parsed = importArchiveMetadataSchema.safeParse(archiveMetadata);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Import batch metadata is invalid.");
  }

  return parsed.data;
}

export async function createAuditRecordFromArchiveMetadata(archiveMetadata: Record<string, unknown>) {
  return createAuditRecord(parseImportArchiveMetadata(archiveMetadata));
}

export async function attachAuditToImportBatch(batchId: string, auditId: string) {
  const encodedBatchId = encodeURIComponent(batchId);
  const importFiles = await supabaseRestRequest<Array<{ id: string }>>(
    `import_files?import_batch_id=eq.${encodedBatchId}&select=id`,
  );

  await patchRows(`import_batches?id=eq.${encodedBatchId}`, {
    audit_id: auditId,
  });
  await patchRows(`import_files?import_batch_id=eq.${encodedBatchId}`, {
    audit_id: auditId,
  });
  const importFileIds = importFiles.map((file) => file.id).filter(Boolean);

  if (importFileIds.length > 0) {
    const encodedIds = importFileIds.map((id) => encodeURIComponent(id)).join(",");
    await patchRows(`raw_import_rows?import_file_id=in.(${encodedIds})`, {
      audit_id: auditId,
    });
  }
}

export async function rollbackImportedAudit(batchId: string, auditId: string) {
  const encodedBatchId = encodeURIComponent(batchId);
  const encodedAuditId = encodeURIComponent(auditId);

  await deleteRows(`control_testing_matrices?audit_id=eq.${encodedAuditId}`);
  await deleteRows(`control_exceptions?audit_id=eq.${encodedAuditId}`);
  await deleteRows(`audit_documents?audit_id=eq.${encodedAuditId}`);
  await deleteRows(`audit_findings?audit_id=eq.${encodedAuditId}`);
  await deleteRows(`report_review_comments?audit_id=eq.${encodedAuditId}`);
  await deleteRows(`report_review_stages?audit_id=eq.${encodedAuditId}`);
  await deleteRows(`audit_notifications?audit_id=eq.${encodedAuditId}`);
  await deleteRows(`audit_time_entries?audit_id=eq.${encodedAuditId}`);
  await deleteRows(`audit_business_contacts?audit_id=eq.${encodedAuditId}`);
  await deleteRows(`audit_users?audit_id=eq.${encodedAuditId}`);
  await deleteRows(`requests?source_import_batch_id=eq.${encodedBatchId}`);
  await deleteRows(`questions?source_import_batch_id=eq.${encodedBatchId}`);
  await deleteRows(`prior_audit_findings?source_import_batch_id=eq.${encodedBatchId}`);
  await deleteRows(`monitoring_results?source_import_batch_id=eq.${encodedBatchId}`);
  await deleteRows(`issues?source_import_batch_id=eq.${encodedBatchId}`);
  await deleteRows(`rcsa_records?source_import_batch_id=eq.${encodedBatchId}`);
  await deleteRows(`risks?source_import_batch_id=eq.${encodedBatchId}`);
  await deleteRows(`controls?source_import_batch_id=eq.${encodedBatchId}`);
  await deleteRows(`third_parties?source_import_batch_id=eq.${encodedBatchId}`);
  await deleteRows(`applications?source_import_batch_id=eq.${encodedBatchId}`);
  await deleteRows(`import_batches?id=eq.${encodedBatchId}`);
  await deleteRows(`audits?id=eq.${encodedAuditId}`);
}

async function createAuditRecord(metadata: CreateAuditMetadata) {
  const sourceBudgetDefaults = metadata.importSourceAuditId
    ? await loadSourceBudgetDefaults(metadata.importSourceAuditId)
    : null;
  const basePayload = {
    name: metadata.auditName,
    company_name: DEFAULT_COMPANY_NAME,
    period_start: metadata.auditPeriodStart,
    period_end: metadata.auditPeriodEnd,
    scope_period_start: metadata.scopePeriodStart,
    scope_period_end: metadata.scopePeriodEnd,
    source_system: metadata.sourceSystem,
    status: "active",
    active_phase: "Planning",
  };
  const fullPayload = {
    ...basePayload,
    total_budget_hours: metadata.totalBudgetHours ?? sourceBudgetDefaults?.total_budget_hours ?? null,
    planning_budget_hours: sourceBudgetDefaults?.planning_budget_hours ?? null,
    fieldwork_budget_hours: sourceBudgetDefaults?.fieldwork_budget_hours ?? null,
    reporting_budget_hours: sourceBudgetDefaults?.reporting_budget_hours ?? null,
  };

  try {
    return await insertSingleRow<AuditRecord>("audits", fullPayload);
  } catch (error) {
    if (isMissingAuditColumnError(error, "company_name")) {
      return createAuditRecordWithoutCompany(metadata, sourceBudgetDefaults?.total_budget_hours ?? null, sourceBudgetDefaults);
    }

    if (
      isMissingAuditColumnError(error, "planning_budget_hours") ||
      isMissingAuditColumnError(error, "fieldwork_budget_hours") ||
      isMissingAuditColumnError(error, "reporting_budget_hours")
    ) {
      return createAuditRecordWithoutPhaseBudgets(basePayload, metadata.totalBudgetHours ?? sourceBudgetDefaults?.total_budget_hours ?? null);
    }

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
        company_name: DEFAULT_COMPANY_NAME,
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

async function createAuditRecordWithoutPhaseBudgets(
  basePayload: Record<string, unknown>,
  totalBudgetHours: number | null,
) {
  try {
    return await insertSingleRow<AuditRecord>("audits", {
      ...basePayload,
      total_budget_hours: totalBudgetHours,
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
        name: basePayload.name,
        company_name: basePayload.company_name,
        period_start: basePayload.period_start,
        period_end: basePayload.period_end,
        source_system: basePayload.source_system,
        status: basePayload.status,
        active_phase: basePayload.active_phase,
        total_budget_hours: totalBudgetHours,
      });
    }

    throw error;
  }
}

async function createAuditRecordWithoutCompany(
  metadata: CreateAuditMetadata,
  fallbackTotalBudgetHours: number | null,
  sourceBudgetDefaults: SourceBudgetDefaults | null,
) {
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
  const fullPayload = {
    ...basePayload,
    total_budget_hours: metadata.totalBudgetHours ?? fallbackTotalBudgetHours,
    planning_budget_hours: sourceBudgetDefaults?.planning_budget_hours ?? null,
    fieldwork_budget_hours: sourceBudgetDefaults?.fieldwork_budget_hours ?? null,
    reporting_budget_hours: sourceBudgetDefaults?.reporting_budget_hours ?? null,
  };

  try {
    return await insertSingleRow<AuditRecord>("audits", fullPayload);
  } catch (error) {
    if (
      isMissingAuditColumnError(error, "planning_budget_hours") ||
      isMissingAuditColumnError(error, "fieldwork_budget_hours") ||
      isMissingAuditColumnError(error, "reporting_budget_hours")
    ) {
      return createAuditRecordWithoutPhaseBudgets(basePayload, metadata.totalBudgetHours ?? fallbackTotalBudgetHours);
    }

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
        total_budget_hours: metadata.totalBudgetHours ?? fallbackTotalBudgetHours,
      });
    }

    throw error;
  }
}

async function loadSourceBudgetDefaults(auditId: string): Promise<SourceBudgetDefaults | null> {
  const encodedAuditId = encodeURIComponent(auditId);
  const rows = await supabaseRestRequest<SourceBudgetDefaults[]>(
    `audits?id=eq.${encodedAuditId}&select=total_budget_hours,planning_budget_hours,fieldwork_budget_hours,reporting_budget_hours&limit=1`,
  );

  return rows[0] ?? null;
}

function isMissingAuditColumnError(error: unknown, columnName: string) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes(`Could not find the '${columnName}' column`);
}
