import { patchRows, supabaseRestRequest, upsertManyRows } from "@/lib/supabase-rest";

type SourceEntity =
  | "applications"
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

type ImportFileWithRows = {
  id: string;
  source_entity: SourceEntity;
  file_name: string;
  raw_import_rows: RawImportRowRecord[];
};

type RawImportRowRecord = {
  id: string;
  row_number: number;
  source_record_key: string | null;
  raw_payload: Record<string, unknown>;
};

type ImportBatchDetails = {
  id: string;
  audit_id: string | null;
  source_system: string;
  archive_metadata: Record<string, unknown>;
  import_files: ImportFileWithRows[];
};

type ReferenceLookupRow = {
  id: string;
  name?: string;
  email?: string;
  source_record_key?: string;
};

type TransformationSummary = {
  businessUnitsUpserted: number;
  usersUpserted: number;
  applicationsUpserted: number;
  thirdPartiesUpserted: number;
  controlsUpserted: number;
  risksUpserted: number;
  riskControlLinksUpserted: number;
  rcsaRecordsUpserted: number;
  issuesUpserted: number;
  monitoringResultsUpserted: number;
  priorAuditFindingsUpserted: number;
  questionsUpserted: number;
  requestsUpserted: number;
  documentsUpserted: number;
  rowsValidated: number;
};

const batchSelect =
  "id,audit_id,source_system,archive_metadata,import_files(id,source_entity,file_name,raw_import_rows(id,row_number,source_record_key,raw_payload))";

export async function transformImportBatch(batchId: string) {
  const batches = await supabaseRestRequest<ImportBatchDetails[]>(
    `import_batches?id=eq.${encodeURIComponent(batchId)}&select=${batchSelect}`,
  );
  const [batch] = batches;

  if (!batch) {
    throw new Error("Import batch not found.");
  }

  const allRows = batch.import_files.flatMap((file) => file.raw_import_rows);
  const businessUnits = collectBusinessUnitNames(allRows);
  const users = collectUsers(allRows);

  if (businessUnits.length > 0) {
    await upsertManyRows("business_units?on_conflict=name", businessUnits);
  }

  if (users.length > 0) {
    await upsertManyRows("users?on_conflict=email", users);
  }

  const businessUnitLookup = await fetchNameLookup("business_units", "name");
  const userLookup = await fetchEmailLookup();
  const applicationRecords = mapApplications(batch, businessUnitLookup, userLookup);
  const thirdPartyRecords = mapThirdParties(batch, businessUnitLookup, userLookup);
  const riskRecords = mapRisks(batch, businessUnitLookup, userLookup);
  const rcsaRecords = mapRcsaRecords(batch, businessUnitLookup, userLookup);

  if (applicationRecords.length > 0) {
    await upsertManyRows("applications?on_conflict=source_record_key", applicationRecords);
  }

  if (thirdPartyRecords.length > 0) {
    await upsertManyRows("third_parties?on_conflict=source_record_key", thirdPartyRecords);
  }

  const controlRecords = mapControls(batch, businessUnitLookup, userLookup);
  const applicationLookup = await fetchSourceKeyLookup("applications");
  const thirdPartyLookup = await fetchSourceKeyLookup("third_parties");

  if (controlRecords.length > 0) {
    await upsertManyRows("controls?on_conflict=source_record_key", controlRecords);
  }

  if (riskRecords.length > 0) {
    await upsertManyRows("risks?on_conflict=source_record_key", riskRecords);
  }

  if (rcsaRecords.length > 0) {
    await upsertManyRows("rcsa_records?on_conflict=source_record_key", rcsaRecords);
  }

  const riskLookup = await fetchSourceKeyLookup("risks");
  const controlLookup = await fetchSourceKeyLookup("controls");
  const riskControlLinkRecords = mapRiskControlLinks(batch, riskLookup, controlLookup);
  const issueRecords = mapIssues(batch, businessUnitLookup, userLookup, controlLookup);
  const monitoringResultRecords = mapMonitoringResults(batch, businessUnitLookup, userLookup);
  const priorAuditFindingRecords = mapPriorAuditFindings(batch, businessUnitLookup, userLookup, controlLookup);
  const questionRecords = mapQuestions(batch, controlLookup);
  const requestRecords = mapRequests(batch, controlLookup);

  if (riskControlLinkRecords.length > 0) {
    await upsertManyRows("risk_control_links?on_conflict=risk_id,control_id,relation_type", riskControlLinkRecords);
  }

  if (issueRecords.length > 0) {
    await upsertManyRows("issues?on_conflict=source_record_key", issueRecords);
  }

  if (monitoringResultRecords.length > 0) {
    await upsertManyRows("monitoring_results?on_conflict=source_record_key", monitoringResultRecords);
  }

  if (priorAuditFindingRecords.length > 0) {
    await upsertManyRows("prior_audit_findings?on_conflict=source_record_key", priorAuditFindingRecords);
  }

  if (questionRecords.length > 0) {
    await upsertManyRows("questions?on_conflict=source_record_key", questionRecords);
  }

  if (requestRecords.length > 0) {
    await upsertManyRows("requests?on_conflict=source_record_key", requestRecords);
  }

  const questionLookup = await fetchSourceKeyLookup("questions");
  const requestLookup = await fetchSourceKeyLookup("requests");
  const documentRecords = mapAuditDocuments(batch, controlLookup, questionLookup, requestLookup, userLookup);

  if (documentRecords.length > 0) {
    await upsertManyRows("audit_documents?on_conflict=source_record_key", documentRecords);
  }

  const importFileIds = batch.import_files.map((file) => file.id);
  const validRowIds = allRows.map((row) => row.id).filter(Boolean);

  if (importFileIds.length > 0) {
    await patchRawImportRowsAsValidated(importFileIds);
  }

  await patchRows(`import_batches?id=eq.${encodeURIComponent(batch.id)}`, {
    status: "loaded",
  });

  const summary: TransformationSummary = {
    businessUnitsUpserted: businessUnits.length,
    usersUpserted: users.length,
    applicationsUpserted: applicationRecords.length,
    thirdPartiesUpserted: thirdPartyRecords.length,
    controlsUpserted: controlRecords.length,
    risksUpserted: riskRecords.length,
    riskControlLinksUpserted: riskControlLinkRecords.length,
    rcsaRecordsUpserted: rcsaRecords.length,
    issuesUpserted: issueRecords.length,
    monitoringResultsUpserted: monitoringResultRecords.length,
    priorAuditFindingsUpserted: priorAuditFindingRecords.length,
    questionsUpserted: questionRecords.length,
    requestsUpserted: requestRecords.length,
    documentsUpserted: documentRecords.length,
    rowsValidated: validRowIds.length,
  };

  return summary;
}

function mapApplications(
  batch: ImportBatchDetails,
  businessUnitLookup: Map<string, string>,
  userLookup: Map<string, string>,
) {
  return batch.import_files
    .filter((file) => file.source_entity === "applications")
    .flatMap((file) =>
      file.raw_import_rows
        .map((row) => {
          const sourceRecordKey =
            readString(row.raw_payload, ["source_record_key", "application_id", "id", "record_id"]) ?? row.source_record_key;
          const applicationName = readString(row.raw_payload, ["application_name", "name", "title"]);

          if (!sourceRecordKey || !applicationName) {
            return null;
          }

          const businessUnitName = readString(row.raw_payload, ["business_unit", "business_unit_name"]);
          const ownerEmail = readString(row.raw_payload, ["application_owner_email", "owner_email"]);

          return {
            audit_id: batch.audit_id,
            source_system: batch.source_system,
            source_record_key: sourceRecordKey,
            application_name: applicationName,
            business_unit_id: businessUnitName ? businessUnitLookup.get(normalizeKey(businessUnitName)) ?? null : null,
            criticality: readString(row.raw_payload, ["criticality"]),
            hosting_model: readString(row.raw_payload, ["hosting_model", "hosting"]),
            application_owner_user_id: ownerEmail ? userLookup.get(normalizeKey(ownerEmail)) ?? null : null,
            lifecycle_status: readString(row.raw_payload, ["lifecycle_status", "status"]),
            vendor_name: readString(row.raw_payload, ["vendor_name", "vendor"]),
            last_risk_review: toDate(readString(row.raw_payload, ["last_risk_review", "last_review_date"])),
            last_refreshed: toDate(readString(row.raw_payload, ["last_refreshed", "updated_at", "last_updated"])),
            known_control_gaps: toBoolean(readString(row.raw_payload, ["known_control_gaps", "control_gaps"])) ?? false,
            source_import_batch_id: batch.id,
            source_payload: row.raw_payload,
          };
        })
        .filter(nonNullable),
    );
}

function mapThirdParties(
  batch: ImportBatchDetails,
  businessUnitLookup: Map<string, string>,
  userLookup: Map<string, string>,
) {
  return batch.import_files
    .filter((file) => file.source_entity === "third_parties")
    .flatMap((file) =>
      file.raw_import_rows
        .map((row) => {
          const sourceRecordKey =
            readString(row.raw_payload, ["source_record_key", "third_party_id", "vendor_id", "id", "record_id"]) ?? row.source_record_key;
          const thirdPartyName = readString(row.raw_payload, ["third_party_name", "vendor_name", "name"]);

          if (!sourceRecordKey || !thirdPartyName) {
            return null;
          }

          const businessUnitName = readString(row.raw_payload, ["business_unit", "business_unit_name"]);
          const ownerEmail = readString(row.raw_payload, ["vendor_owner_email", "owner_email"]);

          return {
            audit_id: batch.audit_id,
            source_system: batch.source_system,
            source_record_key: sourceRecordKey,
            third_party_name: thirdPartyName,
            service_category: readString(row.raw_payload, ["service_category", "category"]),
            criticality: readString(row.raw_payload, ["criticality"]),
            control_attestation: readString(row.raw_payload, ["control_attestation", "attestation"]),
            business_unit_id: businessUnitName ? businessUnitLookup.get(normalizeKey(businessUnitName)) ?? null : null,
            vendor_owner_user_id: ownerEmail ? userLookup.get(normalizeKey(ownerEmail)) ?? null : null,
            lifecycle_status: readString(row.raw_payload, ["lifecycle_status", "status"]),
            last_review_date: toDate(readString(row.raw_payload, ["last_review_date", "review_date"])),
            contract_renewal_date: toDate(readString(row.raw_payload, ["contract_renewal_date", "renewal_date"])),
            open_issues_count: toInteger(readString(row.raw_payload, ["open_issues_count", "issues_count"])) ?? 0,
            source_import_batch_id: batch.id,
            source_payload: row.raw_payload,
          };
        })
        .filter(nonNullable),
    );
}

function mapControls(
  batch: ImportBatchDetails,
  businessUnitLookup: Map<string, string>,
  userLookup: Map<string, string>,
) {
  return batch.import_files
    .filter((file) => file.source_entity === "controls")
    .flatMap((file) =>
      file.raw_import_rows
        .map((row) => {
          const sourceRecordKey = readString(row.raw_payload, ["source_record_key", "control_id", "id", "record_id"]) ?? row.source_record_key;
          const controlName = readString(row.raw_payload, ["control_name", "name", "title"]);

          if (!sourceRecordKey || !controlName) {
            return null;
          }

          const businessUnitName = readString(row.raw_payload, ["business_unit", "business_unit_name", "business_unit_id"]);
          const ownerEmail = readString(row.raw_payload, ["control_owner_email", "owner_email", "application_owner_email"]);

          return {
            audit_id: batch.audit_id,
            source_system: batch.source_system,
            source_record_key: sourceRecordKey,
            control_name: controlName,
            business_unit_id: businessUnitName ? businessUnitLookup.get(normalizeKey(businessUnitName)) ?? null : null,
            control_owner_user_id: ownerEmail ? userLookup.get(normalizeKey(ownerEmail)) ?? null : null,
            status: toControlStatus(readString(row.raw_payload, ["status", "control_status"])),
            due_date: toDate(readString(row.raw_payload, ["due_date", "target_date"])),
            planned_hours: toNumeric(readString(row.raw_payload, ["planned_hours", "estimated_hours"])) ?? 0,
            actual_hours: toNumeric(readString(row.raw_payload, ["actual_hours", "hours_logged"])) ?? 0,
            risk_rating: toRiskRating(readString(row.raw_payload, ["risk_rating", "risk_level", "severity"])),
            control_frequency: readString(row.raw_payload, ["control_frequency", "frequency"]),
            testing_sample_size: toInteger(readString(row.raw_payload, ["testing_sample_size", "sample_size"])),
            source_import_batch_id: batch.id,
            source_payload: row.raw_payload,
          };
        })
        .filter(nonNullable),
    );
}

function mapRisks(
  batch: ImportBatchDetails,
  businessUnitLookup: Map<string, string>,
  userLookup: Map<string, string>,
) {
  return batch.import_files
    .filter((file) => file.source_entity === "risks")
    .flatMap((file) =>
      file.raw_import_rows
        .map((row) => {
          const sourceRecordKey = readString(row.raw_payload, ["source_record_key", "risk_id", "id", "record_id"]) ?? row.source_record_key;
          const riskStatement = readString(row.raw_payload, ["risk_statement", "statement", "name", "title"]);

          if (!sourceRecordKey || !riskStatement) {
            return null;
          }

          const businessUnitName = readString(row.raw_payload, ["business_unit", "business_unit_name"]);
          const ownerEmail = readString(row.raw_payload, ["risk_owner_email", "owner_email"]);

          return {
            audit_id: batch.audit_id,
            source_system: batch.source_system,
            source_record_key: sourceRecordKey,
            risk_statement: riskStatement,
            business_unit_id: businessUnitName ? businessUnitLookup.get(normalizeKey(businessUnitName)) ?? null : null,
            inherent_likelihood: readString(row.raw_payload, ["inherent_likelihood", "likelihood"]),
            inherent_impact: readString(row.raw_payload, ["inherent_impact", "impact"]),
            inherent_risk_rating: toRiskRating(readString(row.raw_payload, ["inherent_risk_rating", "inherent_rating", "risk_rating"])),
            residual_risk_rating: toRiskRating(readString(row.raw_payload, ["residual_risk_rating", "residual_rating"])),
            risk_owner_user_id: ownerEmail ? userLookup.get(normalizeKey(ownerEmail)) ?? null : null,
            status: readString(row.raw_payload, ["status"]) ?? "open",
            last_reviewed: toDate(readString(row.raw_payload, ["last_reviewed", "last_review_date"])),
            next_review_date: toDate(readString(row.raw_payload, ["next_review_date", "next_review"])),
            source_import_batch_id: batch.id,
            source_payload: row.raw_payload,
          };
        })
        .filter(nonNullable),
    );
}

function mapRcsaRecords(
  batch: ImportBatchDetails,
  businessUnitLookup: Map<string, string>,
  userLookup: Map<string, string>,
) {
  return batch.import_files
    .filter((file) => file.source_entity === "rcsa_records")
    .flatMap((file) =>
      file.raw_import_rows
        .map((row) => {
          const sourceRecordKey = readString(row.raw_payload, ["source_record_key", "rcsa_id", "id", "record_id"]) ?? row.source_record_key;
          const riskStatement = readString(row.raw_payload, ["risk_statement", "statement", "name"]);

          if (!sourceRecordKey || !riskStatement) {
            return null;
          }

          const businessUnitName = readString(row.raw_payload, ["business_unit", "business_unit_name"]);
          const ownerEmail = readString(row.raw_payload, ["risk_owner_email", "owner_email"]);

          return {
            audit_id: batch.audit_id,
            source_system: batch.source_system,
            source_record_key: sourceRecordKey,
            business_unit_id: businessUnitName ? businessUnitLookup.get(normalizeKey(businessUnitName)) ?? null : null,
            risk_statement: riskStatement,
            residual_risk_rating: toRiskRating(readString(row.raw_payload, ["residual_risk_rating", "risk_rating"])),
            key_controls: toTextArray(readString(row.raw_payload, ["key_controls", "controls", "linked_controls"])),
            last_reviewed: toDate(readString(row.raw_payload, ["last_reviewed", "last_review_date"])),
            risk_owner_user_id: ownerEmail ? userLookup.get(normalizeKey(ownerEmail)) ?? null : null,
            source_import_batch_id: batch.id,
            source_payload: row.raw_payload,
          };
        })
        .filter(nonNullable),
    );
}

function mapRiskControlLinks(
  batch: ImportBatchDetails,
  riskLookup: Map<string, string>,
  controlLookup: Map<string, string>,
) {
  const rawLinks = batch.import_files
    .filter((file) => file.source_entity === "risk_control_links" || file.source_entity === "risks")
    .flatMap((file) =>
      file.raw_import_rows
        .map((row) => {
          const riskSourceKey =
            file.source_entity === "risks"
              ? readString(row.raw_payload, ["source_record_key", "risk_id", "risk_record_id", "id", "record_id"]) ?? row.source_record_key
              : readString(row.raw_payload, [
                  "risk_source_record_key",
                  "risk_id",
                  "linked_risk_id",
                  "risk_record_id",
                  "parent_risk_id",
                ]);
          const controlSourceKey =
            file.source_entity === "risks"
              ? readString(row.raw_payload, [
                  "related_control_source_record_key",
                  "related_control_record_id",
                  "related_control_id",
                  "control_source_record_key",
                  "control_id",
                  "linked_control_id",
                ])
              : readString(row.raw_payload, [
                  "control_source_record_key",
                  "control_id",
                  "linked_control_id",
                  "control_record_id",
                  "child_control_id",
                ]);
          const riskId = riskSourceKey ? riskLookup.get(normalizeKey(riskSourceKey)) ?? null : null;
          const controlId = controlSourceKey ? controlLookup.get(normalizeKey(controlSourceKey)) ?? null : null;

          if (!riskId || !controlId) {
            return null;
          }

          return {
            risk_id: riskId,
            control_id: controlId,
            relation_type: readString(row.raw_payload, ["relation_type", "relationship_type", "link_type"]) ?? "mitigates",
            link_strength: readString(row.raw_payload, ["link_strength", "strength", "relationship_strength"]),
          };
        })
        .filter(nonNullable),
    );

  const dedupedLinks = new Map<string, (typeof rawLinks)[number]>();

  for (const link of rawLinks) {
    dedupedLinks.set(`${link.risk_id}::${link.control_id}::${link.relation_type}`, link);
  }

  return [...dedupedLinks.values()];
}

function mapIssues(
  batch: ImportBatchDetails,
  businessUnitLookup: Map<string, string>,
  userLookup: Map<string, string>,
  controlLookup: Map<string, string>,
) {
  return batch.import_files
    .filter((file) => file.source_entity === "issues")
    .flatMap((file) =>
      file.raw_import_rows
        .map((row) => {
          const sourceRecordKey = readString(row.raw_payload, ["source_record_key", "issue_id", "id", "record_id"]) ?? row.source_record_key;
          const issueSummary = readString(row.raw_payload, ["issue_summary", "summary", "title", "description"]);

          if (!sourceRecordKey || !issueSummary) {
            return null;
          }

          const businessUnitName = readString(row.raw_payload, ["business_unit", "business_unit_name"]);
          const ownerEmail = readString(row.raw_payload, ["issue_owner_email", "owner_email"]);
          const controlSourceKey = readString(row.raw_payload, ["control_source_record_key", "control_id", "linked_control_id"]);

          return {
            audit_id: batch.audit_id,
            source_system: batch.source_system,
            source_record_key: sourceRecordKey,
            control_id: controlSourceKey ? controlLookup.get(normalizeKey(controlSourceKey)) ?? null : null,
            issue_summary: issueSummary,
            status: readString(row.raw_payload, ["status"]) ?? "open",
            severity: toRiskRating(readString(row.raw_payload, ["severity", "risk_rating"])),
            business_unit_id: businessUnitName ? businessUnitLookup.get(normalizeKey(businessUnitName)) ?? null : null,
            date_opened: toDate(readString(row.raw_payload, ["date_opened", "opened_date"])),
            target_remediation_date: toDate(readString(row.raw_payload, ["target_remediation_date", "remediation_date", "due_date"])),
            issue_owner_user_id: ownerEmail ? userLookup.get(normalizeKey(ownerEmail)) ?? null : null,
            root_cause: readString(row.raw_payload, ["root_cause"]),
            remediation_progress: readString(row.raw_payload, ["remediation_progress", "progress"]),
            source_import_batch_id: batch.id,
            source_payload: row.raw_payload,
          };
        })
        .filter(nonNullable),
    );
}

function mapMonitoringResults(
  batch: ImportBatchDetails,
  businessUnitLookup: Map<string, string>,
  userLookup: Map<string, string>,
) {
  return batch.import_files
    .filter((file) => file.source_entity === "monitoring_results")
    .flatMap((file) =>
      file.raw_import_rows
        .map((row) => {
          const sourceRecordKey =
            readString(row.raw_payload, ["source_record_key", "monitoring_result_id", "id", "record_id"]) ?? row.source_record_key;
          const title = readString(row.raw_payload, ["title", "name"]);
          const summary = readString(row.raw_payload, ["summary", "description"]);

          if (!sourceRecordKey || !title || !summary) {
            return null;
          }

          const businessUnitName = readString(row.raw_payload, ["business_unit", "business_unit_name"]);
          const analystEmail = readString(row.raw_payload, ["analyst_email", "owner_email"]);

          return {
            audit_id: batch.audit_id,
            source_system: batch.source_system,
            source_record_key: sourceRecordKey,
            title,
            business_unit_id: businessUnitName ? businessUnitLookup.get(normalizeKey(businessUnitName)) ?? null : null,
            severity: toRiskRating(readString(row.raw_payload, ["severity", "risk_rating"])),
            summary,
            status: readString(row.raw_payload, ["status"]) ?? "open",
            run_date: toDate(readString(row.raw_payload, ["run_date", "date_run"])),
            next_due_date: toDate(readString(row.raw_payload, ["next_due_date", "due_date"])),
            analyst_user_id: analystEmail ? userLookup.get(normalizeKey(analystEmail)) ?? null : null,
            source_import_batch_id: batch.id,
            source_payload: row.raw_payload,
          };
        })
        .filter(nonNullable),
    );
}

function mapPriorAuditFindings(
  batch: ImportBatchDetails,
  businessUnitLookup: Map<string, string>,
  userLookup: Map<string, string>,
  controlLookup: Map<string, string>,
) {
  return batch.import_files
    .filter((file) => file.source_entity === "prior_audit_findings")
    .flatMap((file) =>
      file.raw_import_rows
        .map((row) => {
          const sourceRecordKey =
            readString(row.raw_payload, ["source_record_key", "finding_id", "id", "record_id"]) ?? row.source_record_key;
          const priorAuditName = readString(row.raw_payload, ["prior_audit_name", "audit_name"]);
          const findingDescription = readString(row.raw_payload, ["finding_description", "description", "summary"]);

          if (!sourceRecordKey || !priorAuditName || !findingDescription) {
            return null;
          }

          const businessUnitName = readString(row.raw_payload, ["business_unit", "business_unit_name"]);
          const ownerEmail = readString(row.raw_payload, ["open_action_owner_email", "owner_email"]);
          const controlSourceKey = readString(row.raw_payload, ["related_control_source_record_key", "related_control_id", "control_id"]);

          return {
            audit_id: batch.audit_id,
            source_system: batch.source_system,
            source_record_key: sourceRecordKey,
            prior_audit_name: priorAuditName,
            finding_description: findingDescription,
            status: readString(row.raw_payload, ["status"]) ?? "open",
            severity: toRiskRating(readString(row.raw_payload, ["severity", "risk_rating"])),
            business_unit_id: businessUnitName ? businessUnitLookup.get(normalizeKey(businessUnitName)) ?? null : null,
            related_control_id: controlSourceKey ? controlLookup.get(normalizeKey(controlSourceKey)) ?? null : null,
            issue_date: toDate(readString(row.raw_payload, ["issue_date", "finding_date"])),
            open_action_owner_user_id: ownerEmail ? userLookup.get(normalizeKey(ownerEmail)) ?? null : null,
            source_import_batch_id: batch.id,
            source_payload: row.raw_payload,
          };
        })
        .filter(nonNullable),
    );
}

function mapQuestions(batch: ImportBatchDetails, controlLookup: Map<string, string>) {
  return batch.import_files
    .filter((file) => file.source_entity === "questions")
    .flatMap((file) =>
      file.raw_import_rows
        .map((row) => {
          const sourceRecordKey = readString(row.raw_payload, ["source_record_key", "question_id", "id", "record_id"]) ?? row.source_record_key;
          const questionText = readString(row.raw_payload, ["question_text", "question", "description"]);
          const controlSourceKey = readString(row.raw_payload, ["control_source_record_key", "control_id", "linked_control_id"]);

          if (!sourceRecordKey || !questionText) {
            return null;
          }

          return {
            audit_id: batch.audit_id,
            source_system: batch.source_system,
            source_record_key: sourceRecordKey,
            control_id: controlSourceKey ? controlLookup.get(normalizeKey(controlSourceKey)) ?? null : null,
            assigned_to: readString(row.raw_payload, ["assigned_to", "requested_from", "owner"]) ?? "Unassigned",
            date_sent: toDate(readString(row.raw_payload, ["date_sent", "created_date", "sent_date"])),
            due_date: toDate(readString(row.raw_payload, ["due_date", "target_date"])),
            status: toQuestionStatus(readString(row.raw_payload, ["status", "question_status"])),
            question_text: questionText,
            response_text: readString(row.raw_payload, ["response_text", "response"]),
            response_date: toDate(readString(row.raw_payload, ["response_date"])),
            source_import_batch_id: batch.id,
            source_payload: row.raw_payload,
          };
        })
        .filter(nonNullable),
    );
}

function mapRequests(batch: ImportBatchDetails, controlLookup: Map<string, string>) {
  return batch.import_files
    .filter((file) => file.source_entity === "requests")
    .flatMap((file) =>
      file.raw_import_rows
        .map((row) => {
          const sourceRecordKey = readString(row.raw_payload, ["source_record_key", "request_id", "id", "record_id"]) ?? row.source_record_key;
          const description = readString(row.raw_payload, ["description", "request_description", "request_text"]);
          const controlSourceKey = readString(row.raw_payload, ["control_source_record_key", "control_id", "linked_control_id"]);

          if (!sourceRecordKey || !description) {
            return null;
          }

          return {
            audit_id: batch.audit_id,
            source_system: batch.source_system,
            source_record_key: sourceRecordKey,
            control_id: controlSourceKey ? controlLookup.get(normalizeKey(controlSourceKey)) ?? null : null,
            description,
            requested_from: readString(row.raw_payload, ["requested_from", "assigned_to", "owner"]) ?? "Unassigned",
            date_requested: toDate(readString(row.raw_payload, ["date_requested", "created_date", "request_date"])),
            due_date: toDate(readString(row.raw_payload, ["due_date", "target_date"])),
            status: toRequestStatus(readString(row.raw_payload, ["status", "request_status"])),
            response_notes: readString(row.raw_payload, ["response_notes", "response_text", "notes"]),
            source_import_batch_id: batch.id,
            source_payload: row.raw_payload,
          };
        })
        .filter(nonNullable),
    );
}

function mapAuditDocuments(
  batch: ImportBatchDetails,
  controlLookup: Map<string, string>,
  questionLookup: Map<string, string>,
  requestLookup: Map<string, string>,
  userLookup: Map<string, string>,
) {
  return batch.import_files
    .filter((file) => file.source_entity === "documents")
    .flatMap((file) =>
      file.raw_import_rows
        .map((row) => {
          const sourceRecordKey = readString(row.raw_payload, ["source_record_key", "document_id", "id", "record_id"]) ?? row.source_record_key;
          const title = readString(row.raw_payload, ["title", "document_title", "name"]);

          if (!sourceRecordKey || !title) {
            return null;
          }

          const controlSourceKey = readString(row.raw_payload, ["control_source_record_key", "control_id", "linked_control_id"]);
          const questionSourceKey = readString(row.raw_payload, ["question_source_record_key", "question_id", "linked_question_id"]);
          const requestSourceKey = readString(row.raw_payload, ["request_source_record_key", "request_id", "linked_request_id"]);
          const ownerEmail = readString(row.raw_payload, ["owner_email", "document_owner_email"]);

          return {
            audit_id: batch.audit_id,
            source_system: batch.source_system,
            source_record_key: sourceRecordKey,
            document_type: readString(row.raw_payload, ["document_type", "type"]) ?? "WORKPAPER",
            title,
            control_id: controlSourceKey ? controlLookup.get(normalizeKey(controlSourceKey)) ?? null : null,
            question_id: questionSourceKey ? questionLookup.get(normalizeKey(questionSourceKey)) ?? null : null,
            request_id: requestSourceKey ? requestLookup.get(normalizeKey(requestSourceKey)) ?? null : null,
            owner_user_id: ownerEmail ? userLookup.get(normalizeKey(ownerEmail)) ?? null : null,
            status: toDocumentStatus(readString(row.raw_payload, ["status", "document_status"])),
            due_date: toDate(readString(row.raw_payload, ["due_date", "target_date"])),
            template_name: readString(row.raw_payload, ["template_name", "file_name"]),
            source_import_batch_id: batch.id,
            source_payload: row.raw_payload,
          };
        })
        .filter(nonNullable),
    );
}

async function fetchNameLookup(table: string, column: string) {
  const rows = await supabaseRestRequest<ReferenceLookupRow[]>(`${table}?select=id,${column}`);
  return new Map(rows.map((row) => [normalizeKey(row[column as keyof ReferenceLookupRow] as string), row.id]));
}

async function fetchEmailLookup() {
  const rows = await supabaseRestRequest<ReferenceLookupRow[]>("users?select=id,email");
  return new Map(rows.filter((row) => row.email).map((row) => [normalizeKey(row.email!), row.id]));
}

async function fetchSourceKeyLookup(table: string) {
  const rows = await supabaseRestRequest<ReferenceLookupRow[]>(`${table}?select=id,source_record_key`);
  return new Map(rows.filter((row) => row.source_record_key).map((row) => [normalizeKey(row.source_record_key!), row.id]));
}

async function patchRawImportRowsAsValidated(importFileIds: string[]) {
  for (const chunk of chunkValues(importFileIds, 25)) {
    const filter = chunk.map((value) => `"${value}"`).join(",");

    await patchRows(`raw_import_rows?import_file_id=in.(${encodeURIComponent(filter)})`, {
      validation_status: "validated",
      validation_errors: [],
    });
  }
}

function collectBusinessUnitNames(rows: RawImportRowRecord[]) {
  const names = new Set<string>();

  for (const row of rows) {
    const name = readString(row.raw_payload, ["business_unit", "business_unit_name"]);

    if (name) {
      names.add(name.trim());
    }
  }

  return [...names].map((name) => ({ name }));
}

function collectUsers(rows: RawImportRowRecord[]) {
  const users = new Map<string, { email: string; full_name: string; role: string; team: string | null }>();

  for (const row of rows) {
    const candidates = [
      {
        email: readString(row.raw_payload, ["control_owner_email", "owner_email", "document_owner_email"]),
        fullName: readString(row.raw_payload, ["control_owner_name", "owner_name", "document_owner_name"]) ?? "Imported User",
      },
      {
        email: readString(row.raw_payload, ["asked_by_email"]),
        fullName: readString(row.raw_payload, ["asked_by_name"]) ?? "Imported User",
      },
    ];

    for (const candidate of candidates) {
      if (!candidate.email) {
        continue;
      }

      users.set(normalizeKey(candidate.email), {
        email: candidate.email,
        full_name: candidate.fullName,
        role: "imported_user",
        team: "Imported",
      });
    }
  }

  return [...users.values()];
}

function readString(payload: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const entry = Object.entries(payload).find(([key]) => normalizeKey(key) === normalizeKey(alias));

    if (!entry) {
      continue;
    }

    const value = entry[1];

    if (value === null || value === undefined) {
      continue;
    }

    const stringValue = String(value).trim();

    if (stringValue.length > 0) {
      return stringValue;
    }
  }

  return null;
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function toDate(value: string | null) {
  if (!value) {
    return null;
  }

  const isoCandidate = new Date(value);

  if (!Number.isNaN(isoCandidate.getTime())) {
    return isoCandidate.toISOString().slice(0, 10);
  }

  return null;
}

function toInteger(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumeric(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = normalizeEnum(value);

  if (normalized === "yes" || normalized === "true" || normalized === "1") {
    return true;
  }

  if (normalized === "no" || normalized === "false" || normalized === "0") {
    return false;
  }

  return null;
}

function toTextArray(value: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(/[|;,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function toRiskRating(value: string | null) {
  const normalized = normalizeEnum(value);

  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }

  return "medium";
}

function toControlStatus(value: string | null) {
  const normalized = normalizeEnum(value);

  if (
    normalized === "not_started" ||
    normalized === "in_progress" ||
    normalized === "aic_review" ||
    normalized === "manager_review" ||
    normalized === "director_review" ||
    normalized === "complete"
  ) {
    return normalized;
  }

  return "not_started";
}

function toQuestionStatus(value: string | null) {
  const normalized = normalizeEnum(value);

  if (normalized === "open" || normalized === "responded" || normalized === "overdue") {
    return normalized;
  }

  return "open";
}

function toRequestStatus(value: string | null) {
  const normalized = normalizeEnum(value);

  if (normalized === "open" || normalized === "in_progress" || normalized === "completed") {
    return normalized;
  }

  return "open";
}

function toDocumentStatus(value: string | null) {
  const normalized = normalizeEnum(value);

  if (normalized === "not_started" || normalized === "in_progress" || normalized === "complete") {
    return normalized;
  }

  return "not_started";
}

function normalizeEnum(value: string | null) {
  if (!value) {
    return "";
  }

  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function nonNullable<T>(value: T | null): value is T {
  return value !== null;
}

function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}
