import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { planningSources, rcsaRecords } from "@/lib/data/mock-data";
import type { AuditPhase, PlanningSourceSet, RCSARecord } from "@/types/audit";

type PlanningAuditRecord = {
  id: string;
  name: string;
  status: string;
  active_phase: string | null;
};

type UserLookupRow = {
  id: string;
  full_name: string;
};

type BusinessUnitLookupRow = {
  id: string;
  name: string;
};

type ApplicationSourceRow = {
  id: string;
  source_record_key: string | null;
  source_system: string;
  application_name: string;
  business_unit_id: string | null;
  criticality: string | null;
  hosting_model: string | null;
  application_owner_user_id: string | null;
  lifecycle_status: string | null;
  vendor_name: string | null;
  last_risk_review: string | null;
  last_refreshed: string | null;
  known_control_gaps: boolean;
  source_payload: Record<string, unknown>;
  updated_at: string;
};

type ThirdPartySourceRow = {
  id: string;
  source_record_key: string | null;
  source_system: string;
  third_party_name: string;
  service_category: string | null;
  criticality: string | null;
  control_attestation: string | null;
  vendor_owner_user_id: string | null;
  lifecycle_status: string | null;
  last_review_date: string | null;
  contract_renewal_date: string | null;
  open_issues_count: number;
  source_payload: Record<string, unknown>;
  updated_at: string;
};

type RcsaSourceRow = {
  id: string;
  source_record_key: string | null;
  source_system: string;
  business_unit_id: string | null;
  risk_statement: string;
  residual_risk_rating: string;
  key_controls: string[];
  last_reviewed: string | null;
  risk_owner_user_id: string | null;
  source_payload: Record<string, unknown>;
  updated_at: string;
};

type IssueSourceRow = {
  id: string;
  source_record_key: string | null;
  source_system: string;
  issue_summary: string;
  status: string;
  severity: string;
  business_unit_id: string | null;
  date_opened: string | null;
  target_remediation_date: string | null;
  issue_owner_user_id: string | null;
  root_cause: string | null;
  remediation_progress: string | null;
  source_payload: Record<string, unknown>;
  updated_at: string;
};

type MonitoringSourceRow = {
  id: string;
  source_record_key: string | null;
  source_system: string;
  title: string;
  business_unit_id: string | null;
  severity: string;
  summary: string;
  status: string;
  run_date: string | null;
  next_due_date: string | null;
  analyst_user_id: string | null;
  source_payload: Record<string, unknown>;
  updated_at: string;
};

type PriorFindingSourceRow = {
  id: string;
  source_record_key: string | null;
  source_system: string;
  prior_audit_name: string;
  finding_description: string;
  status: string;
  severity: string;
  business_unit_id: string | null;
  issue_date: string | null;
  open_action_owner_user_id: string | null;
  source_payload: Record<string, unknown>;
  updated_at: string;
};

export type PlanningViewModel = {
  auditId: string | null;
  auditLabel: string;
  auditStatus: string;
  currentPhase: AuditPhase;
  planningSources: PlanningSourceSet[];
  rcsaRecords: RCSARecord[];
};

export async function getPlanningViewModel({
  auditId,
  auditLabel,
  mode,
}: {
  auditId?: string;
  auditLabel?: string;
  mode: "prototype" | "live";
}): Promise<PlanningViewModel> {
  if (mode !== "live" || !auditId) {
    return {
      auditId: null,
      auditLabel: auditLabel ?? "Prototype Demo Audit",
      auditStatus: "prototype",
      currentPhase: "Planning",
      planningSources,
      rcsaRecords,
    };
  }

  const supabase = createSupabaseAdminClient();
  const [
    auditResult,
    usersResult,
    businessUnitsResult,
    applicationsResult,
    thirdPartiesResult,
    rcsaResult,
    issuesResult,
    monitoringResult,
    priorFindingsResult,
  ] = await Promise.all([
    supabase.from("audits").select("id, name, status, active_phase").eq("id", auditId).maybeSingle<PlanningAuditRecord>(),
    supabase.from("users").select("id, full_name").returns<UserLookupRow[]>(),
    supabase.from("business_units").select("id, name").returns<BusinessUnitLookupRow[]>(),
    supabase
      .from("applications")
      .select(
        "id, source_record_key, source_system, application_name, business_unit_id, criticality, hosting_model, application_owner_user_id, lifecycle_status, vendor_name, last_risk_review, last_refreshed, known_control_gaps, source_payload, updated_at",
      )
      .eq("audit_id", auditId)
      .returns<ApplicationSourceRow[]>(),
    supabase
      .from("third_parties")
      .select(
        "id, source_record_key, source_system, third_party_name, service_category, criticality, control_attestation, vendor_owner_user_id, lifecycle_status, last_review_date, contract_renewal_date, open_issues_count, source_payload, updated_at",
      )
      .eq("audit_id", auditId)
      .returns<ThirdPartySourceRow[]>(),
    supabase
      .from("rcsa_records")
      .select(
        "id, source_record_key, source_system, business_unit_id, risk_statement, residual_risk_rating, key_controls, last_reviewed, risk_owner_user_id, source_payload, updated_at",
      )
      .eq("audit_id", auditId)
      .returns<RcsaSourceRow[]>(),
    supabase
      .from("issues")
      .select(
        "id, source_record_key, source_system, issue_summary, status, severity, business_unit_id, date_opened, target_remediation_date, issue_owner_user_id, root_cause, remediation_progress, source_payload, updated_at",
      )
      .eq("audit_id", auditId)
      .returns<IssueSourceRow[]>(),
    supabase
      .from("monitoring_results")
      .select(
        "id, source_record_key, source_system, title, business_unit_id, severity, summary, status, run_date, next_due_date, analyst_user_id, source_payload, updated_at",
      )
      .eq("audit_id", auditId)
      .returns<MonitoringSourceRow[]>(),
    supabase
      .from("prior_audit_findings")
      .select(
        "id, source_record_key, source_system, prior_audit_name, finding_description, status, severity, business_unit_id, issue_date, open_action_owner_user_id, source_payload, updated_at",
      )
      .eq("audit_id", auditId)
      .returns<PriorFindingSourceRow[]>(),
  ]);

  const firstError = [
    auditResult.error,
    usersResult.error,
    businessUnitsResult.error,
    applicationsResult.error,
    thirdPartiesResult.error,
    rcsaResult.error,
    issuesResult.error,
    monitoringResult.error,
    priorFindingsResult.error,
  ].find(Boolean);

  if (firstError) {
    throw new Error(firstError.message);
  }

  const userMap = new Map((usersResult.data ?? []).map((user) => [user.id, user.full_name]));
  const businessUnitMap = new Map((businessUnitsResult.data ?? []).map((unit) => [unit.id, unit.name]));
  const liveSources = [
    ...(applicationsResult.data ?? []).map((row) => mapApplicationSource(row, userMap, businessUnitMap)),
    ...(thirdPartiesResult.data ?? []).map((row) => mapThirdPartySource(row, userMap)),
    ...(issuesResult.data ?? []).map((row) => mapIssueSource(row, userMap, businessUnitMap)),
    ...(rcsaResult.data ?? []).map((row) => mapRcsaSource(row, userMap, businessUnitMap)),
    ...(monitoringResult.data ?? []).map((row) => mapMonitoringSource(row, userMap, businessUnitMap)),
    ...(priorFindingsResult.data ?? []).map((row) => mapPriorFindingSource(row, userMap, businessUnitMap)),
  ].sort((left, right) => new Date(right.lastUpdated).getTime() - new Date(left.lastUpdated).getTime());

  const liveRcsa = (rcsaResult.data ?? []).map((row) => mapLiveRcsaRecord(row, businessUnitMap));

  return {
    auditId,
    auditLabel: auditResult.data?.name ?? auditLabel ?? "Live audit workspace",
    auditStatus: auditResult.data?.status ?? "active",
    currentPhase: normalizeAuditPhase(auditResult.data?.active_phase),
    planningSources: liveSources,
    rcsaRecords: liveRcsa,
  };
}

function mapApplicationSource(
  row: ApplicationSourceRow,
  userMap: Map<string, string>,
  businessUnitMap: Map<string, string>,
): PlanningSourceSet {
  const businessUnit = row.business_unit_id ? businessUnitMap.get(row.business_unit_id) : null;
  const owner = row.application_owner_user_id ? userMap.get(row.application_owner_user_id) : null;

  return {
    id: row.source_record_key ?? row.id,
    sourceType: "APPLICATION",
    title: row.application_name,
    summary: `${businessUnit ?? "Unassigned business unit"}${row.lifecycle_status ? ` · ${row.lifecycle_status}` : ""}`,
    sourceSystem: formatSourceSystem(row.source_system),
    lastUpdated: toIsoDateTime(row.last_refreshed ?? row.updated_at),
    dataKind: "SYSTEM_EXPORT",
    artifactName: "Application inventory record",
    owner: owner ?? "Unassigned",
    refreshCadence: "MONTHLY",
    planningUse: "Use this application record to confirm system boundaries, ownership, and integration points that should shape walkthrough and sampling scope.",
    sampleDetails: compactDetails([
      row.criticality ? `Criticality: ${row.criticality}` : null,
      row.hosting_model ? `Hosting model: ${row.hosting_model}` : null,
      row.vendor_name ? `Vendor: ${row.vendor_name}` : null,
      row.lifecycle_status ? `Lifecycle status: ${row.lifecycle_status}` : null,
      row.known_control_gaps ? "Known control gaps have been flagged on the application record." : null,
      ...payloadDetails(row.source_payload, ["application_owner", "integration_points", "business_process_supported", "override_capability"]),
    ]),
    keyFields: ["Application owner", "Criticality", "Hosting model", "Lifecycle status"],
  };
}

function mapThirdPartySource(row: ThirdPartySourceRow, userMap: Map<string, string>): PlanningSourceSet {
  const owner = row.vendor_owner_user_id ? userMap.get(row.vendor_owner_user_id) : null;

  return {
    id: row.source_record_key ?? row.id,
    sourceType: "THIRD_PARTY",
    title: row.third_party_name,
    summary: `${row.service_category ?? "Service category not provided"}${row.criticality ? ` · ${row.criticality}` : ""}`,
    sourceSystem: formatSourceSystem(row.source_system),
    lastUpdated: toIsoDateTime(row.last_review_date ?? row.updated_at),
    dataKind: "ASSESSMENT",
    artifactName: "Third-party inventory record",
    owner: owner ?? "Unassigned",
    refreshCadence: "QUARTERLY",
    planningUse: "Use this third-party record to assess dependency risk, vendor criticality, and whether supporting controls should stay in scope.",
    sampleDetails: compactDetails([
      row.service_category ? `Service category: ${row.service_category}` : null,
      row.criticality ? `Criticality: ${row.criticality}` : null,
      row.control_attestation ? `Control attestation: ${row.control_attestation}` : null,
      row.lifecycle_status ? `Lifecycle status: ${row.lifecycle_status}` : null,
      row.contract_renewal_date ? `Contract renewal date: ${row.contract_renewal_date}` : null,
      row.open_issues_count > 0 ? `Open issues count: ${row.open_issues_count}` : null,
      ...payloadDetails(row.source_payload, ["risk_committee_action", "open_assessment_items", "service_performed"]),
    ]),
    keyFields: ["Service category", "Criticality", "Control attestation", "Open issues count"],
  };
}

function mapIssueSource(
  row: IssueSourceRow,
  userMap: Map<string, string>,
  businessUnitMap: Map<string, string>,
): PlanningSourceSet {
  const businessUnit = row.business_unit_id ? businessUnitMap.get(row.business_unit_id) : null;
  const owner = row.issue_owner_user_id ? userMap.get(row.issue_owner_user_id) : null;

  return {
    id: row.source_record_key ?? row.id,
    sourceType: "OUTSTANDING_ISSUE",
    title: row.issue_summary,
    summary: `${businessUnit ?? "Unassigned business unit"}${row.status ? ` · ${formatLabel(row.status)}` : ""}`,
    sourceSystem: formatSourceSystem(row.source_system),
    lastUpdated: toIsoDateTime(row.date_opened ?? row.updated_at),
    dataKind: "TRACKER",
    artifactName: "Issue tracker record",
    owner: owner ?? "Unassigned",
    refreshCadence: "WEEKLY",
    planningUse: "Use this issue to decide whether prior remediation risk should deepen testing or stay as a scoped watch item.",
    sampleDetails: compactDetails([
      row.severity ? `Severity: ${formatLabel(row.severity)}` : null,
      row.status ? `Status: ${formatLabel(row.status)}` : null,
      row.target_remediation_date ? `Target remediation date: ${row.target_remediation_date}` : null,
      row.root_cause ? `Root cause: ${row.root_cause}` : null,
      row.remediation_progress ? `Remediation progress: ${row.remediation_progress}` : null,
      ...payloadDetails(row.source_payload, ["management_action", "issue_age", "related_control", "scope_implication"]),
    ]),
    keyFields: ["Severity", "Status", "Target remediation date", "Root cause"],
  };
}

function mapRcsaSource(
  row: RcsaSourceRow,
  userMap: Map<string, string>,
  businessUnitMap: Map<string, string>,
): PlanningSourceSet {
  const businessUnit = row.business_unit_id ? businessUnitMap.get(row.business_unit_id) : null;
  const owner = row.risk_owner_user_id ? userMap.get(row.risk_owner_user_id) : null;

  return {
    id: row.source_record_key ?? row.id,
    sourceType: "RCSA",
    title: businessUnit ? `${businessUnit} RCSA` : "RCSA record",
    summary: row.risk_statement,
    sourceSystem: formatSourceSystem(row.source_system),
    lastUpdated: toIsoDateTime(row.last_reviewed ?? row.updated_at),
    dataKind: "ASSESSMENT",
    artifactName: "RCSA record",
    owner: owner ?? "Unassigned",
    refreshCadence: "QUARTERLY",
    planningUse: "Use the RCSA to anchor planning decisions in management-rated residual risk and key control dependencies.",
    sampleDetails: compactDetails([
      `Residual risk: ${formatLabel(row.residual_risk_rating)}`,
      row.key_controls.length > 0 ? `Key controls: ${row.key_controls.join(", ")}` : null,
      ...payloadDetails(row.source_payload, ["management_commentary", "affected_process", "risk_theme"]),
    ]),
    keyFields: ["Residual risk rating", "Risk statement", "Key controls", "Last reviewed"],
  };
}

function mapMonitoringSource(
  row: MonitoringSourceRow,
  userMap: Map<string, string>,
  businessUnitMap: Map<string, string>,
): PlanningSourceSet {
  const businessUnit = row.business_unit_id ? businessUnitMap.get(row.business_unit_id) : null;
  const owner = row.analyst_user_id ? userMap.get(row.analyst_user_id) : null;

  return {
    id: row.source_record_key ?? row.id,
    sourceType: "CONTINUOUS_MONITORING",
    title: row.title,
    summary: `${row.summary}${businessUnit ? ` · ${businessUnit}` : ""}`,
    sourceSystem: formatSourceSystem(row.source_system),
    lastUpdated: toIsoDateTime(row.run_date ?? row.updated_at),
    dataKind: "DATA_FEED",
    artifactName: "Monitoring result",
    owner: owner ?? "Unassigned",
    refreshCadence: "DAILY",
    planningUse: "Use current-state monitoring trends to justify where planning should increase testing depth around active operational pressure points.",
    sampleDetails: compactDetails([
      row.severity ? `Severity: ${formatLabel(row.severity)}` : null,
      row.status ? `Status: ${formatLabel(row.status)}` : null,
      row.next_due_date ? `Next due date: ${row.next_due_date}` : null,
      ...payloadDetails(row.source_payload, ["exception_count", "aging_bucket", "escalation_timestamp", "manual_clear_flag"]),
    ]),
    keyFields: ["Severity", "Status", "Run date", "Next due date"],
  };
}

function mapPriorFindingSource(
  row: PriorFindingSourceRow,
  userMap: Map<string, string>,
  businessUnitMap: Map<string, string>,
): PlanningSourceSet {
  const businessUnit = row.business_unit_id ? businessUnitMap.get(row.business_unit_id) : null;
  const owner = row.open_action_owner_user_id ? userMap.get(row.open_action_owner_user_id) : null;

  return {
    id: row.source_record_key ?? row.id,
    sourceType: "PRIOR_FINDING",
    title: row.prior_audit_name,
    summary: `${row.finding_description}${businessUnit ? ` · ${businessUnit}` : ""}`,
    sourceSystem: formatSourceSystem(row.source_system),
    lastUpdated: toIsoDateTime(row.issue_date ?? row.updated_at),
    dataKind: "MEMO",
    artifactName: "Prior audit finding",
    owner: owner ?? "Unassigned",
    refreshCadence: "AD_HOC",
    planningUse: "Use prior findings to preserve continuity in areas that may still require targeted retesting in the current audit.",
    sampleDetails: compactDetails([
      row.status ? `Status: ${formatLabel(row.status)}` : null,
      row.severity ? `Severity: ${formatLabel(row.severity)}` : null,
      ...payloadDetails(row.source_payload, ["management_action", "retest_need", "related_control", "finding_theme"]),
    ]),
    keyFields: ["Severity", "Status", "Issue date", "Related control"],
  };
}

function mapLiveRcsaRecord(row: RcsaSourceRow, businessUnitMap: Map<string, string>): RCSARecord {
  return {
    id: row.source_record_key ?? row.id,
    businessUnit: row.business_unit_id ? businessUnitMap.get(row.business_unit_id) ?? "Unassigned" : "Unassigned",
    riskStatement: row.risk_statement,
    keyControls: row.key_controls,
    residualRiskRating: normalizeRiskRating(row.residual_risk_rating),
    lastReviewed: toIsoDateTime(row.last_reviewed ?? row.updated_at),
  };
}

function compactDetails(details: Array<string | null>) {
  const filtered = details.filter((value): value is string => Boolean(value && value.trim().length > 0));
  return filtered.length > 0 ? filtered : ["No additional source details were loaded from this record."];
}

function payloadDetails(payload: Record<string, unknown>, keys: string[]) {
  return keys
    .map((key) => {
      const value = readPayloadText(payload, [key]);
      return value ? `${formatLabel(key)}: ${value}` : null;
    })
    .filter((value): value is string => value !== null);
}

function readPayloadText(payload: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const match = Object.entries(payload).find(([key]) => normalizeKey(key) === normalizeKey(alias));

    if (!match) {
      continue;
    }

    const value = match[1];

    if (Array.isArray(value)) {
      const normalized = value.map((item) => String(item).trim()).filter(Boolean).join(", ");

      if (normalized) {
        return normalized;
      }
    }

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }

  return null;
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function formatSourceSystem(value: string | null) {
  if (!value) {
    return "Imported source";
  }

  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatLabel(value: string) {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeAuditPhase(value: string | null | undefined): AuditPhase {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "fieldwork") {
    return "Fieldwork";
  }

  if (normalized === "reporting") {
    return "Reporting";
  }

  return "Planning";
}

function normalizeRiskRating(value: string): RCSARecord["residualRiskRating"] {
  const normalized = value.trim().toLowerCase();

  if (normalized === "low") {
    return "LOW";
  }

  if (normalized === "high") {
    return "HIGH";
  }

  return "MEDIUM";
}

function toIsoDateTime(value: string) {
  return value.includes("T") ? value : `${value}T00:00:00.000Z`;
}
