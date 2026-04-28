import { readFile } from "node:fs/promises";
import path from "node:path";

import { formatAuditPeriod } from "@/lib/live-audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { planningNarrativeTokenMappings, type NarrativeTokenMapping } from "@/lib/planning-narrative/template-mapping";
import type { AuditPhase } from "@/types/audit";

type AuditRow = {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  status: string;
  active_phase: string | null;
  source_system: string | null;
  planning_budget_hours: number | null;
  fieldwork_budget_hours: number | null;
  reporting_budget_hours: number | null;
};

type BusinessUnitRow = {
  id: string;
  name: string;
};

type ControlRow = {
  id: string;
  control_name: string;
  business_unit_id: string | null;
  status: string;
  assigned_owner_user_id: string | null;
  assigned_due_date: string | null;
  assigned_planned_hours: number | null;
  planned_hours: number | null;
  actual_hours: number | null;
  risk_rating: string;
  control_frequency: string | null;
  testing_sample_size: number | null;
  source_payload: Record<string, unknown>;
};

type ApplicationRow = {
  id: string;
  application_name: string;
  business_unit_id: string | null;
  criticality: string | null;
  hosting_model: string | null;
  lifecycle_status: string | null;
  vendor_name: string | null;
  source_payload: Record<string, unknown>;
};

type ThirdPartyRow = {
  id: string;
  third_party_name: string;
  business_unit_id: string | null;
  service_category: string | null;
  criticality: string | null;
  lifecycle_status: string | null;
  open_issues_count: number;
  source_payload: Record<string, unknown>;
};

type RcsaRow = {
  id: string;
  business_unit_id: string | null;
  risk_statement: string;
  residual_risk_rating: string;
  key_controls: string[];
  source_payload: Record<string, unknown>;
};

type IssueRow = {
  id: string;
  issue_summary: string;
  status: string;
  severity: string;
  business_unit_id: string | null;
  target_remediation_date: string | null;
  root_cause: string | null;
  remediation_progress: string | null;
  source_payload: Record<string, unknown>;
};

type MonitoringRow = {
  id: string;
  title: string;
  summary: string;
  severity: string;
  status: string;
  business_unit_id: string | null;
  source_payload: Record<string, unknown>;
};

type PriorFindingRow = {
  id: string;
  prior_audit_name: string;
  finding_description: string;
  status: string;
  severity: string;
  business_unit_id: string | null;
  source_payload: Record<string, unknown>;
};

type AuditDocumentRow = {
  id: string;
  document_type: string;
  title: string;
  status: string;
};

type NarrativeDataContext = {
  applications: ApplicationRow[];
  audit: AuditRow;
  auditDocuments: AuditDocumentRow[];
  businessUnitMap: Map<string, string>;
  controls: ControlRow[];
  issues: IssueRow[];
  monitoringResults: MonitoringRow[];
  priorAuditFindings: PriorFindingRow[];
  rcsaRecords: RcsaRow[];
  thirdParties: ThirdPartyRow[];
};

export type PlanningNarrativeViewModel = {
  auditId: string;
  missingRequiredTokens: string[];
  renderedTemplate: string;
  template: string;
  tokenMappings: Array<
    NarrativeTokenMapping & {
      resolvedValue: string;
    }
  >;
  tokenValues: Record<string, string>;
};

export async function getPlanningNarrativeViewModel(auditId: string): Promise<PlanningNarrativeViewModel> {
  const template = await loadPlanningNarrativeTemplate();
  const context = await loadNarrativeDataContext(auditId);
  const tokenValues = buildTokenValues(context);
  const missingRequiredTokens = planningNarrativeTokenMappings
    .filter((mapping) => mapping.required && (!tokenValues[mapping.token] || tokenValues[mapping.token].trim().length === 0))
    .map((mapping) => mapping.token);

  return {
    auditId,
    missingRequiredTokens,
    renderedTemplate: renderPlanningNarrativeTemplate(template, tokenValues),
    template,
    tokenMappings: planningNarrativeTokenMappings.map((mapping) => ({
      ...mapping,
      resolvedValue: tokenValues[mapping.token] ?? "",
    })),
    tokenValues,
  };
}

async function loadPlanningNarrativeTemplate() {
  const templatePath = path.join(process.cwd(), "src", "lib", "planning-narrative", "template.md");
  return readFile(templatePath, "utf8");
}

async function loadNarrativeDataContext(auditId: string): Promise<NarrativeDataContext> {
  const supabase = createSupabaseAdminClient();
  const [
    auditResult,
    businessUnitsResult,
    controlsResult,
    applicationsResult,
    thirdPartiesResult,
    rcsaResult,
    issuesResult,
    monitoringResult,
    priorFindingsResult,
    documentsResult,
  ] = await Promise.all([
    supabase
      .from("audits")
      .select(
        "id, name, period_start, period_end, status, active_phase, source_system, planning_budget_hours, fieldwork_budget_hours, reporting_budget_hours",
      )
      .eq("id", auditId)
      .maybeSingle<AuditRow>(),
    supabase.from("business_units").select("id, name").returns<BusinessUnitRow[]>(),
    supabase
      .from("controls")
      .select(
        "id, control_name, business_unit_id, status, assigned_owner_user_id, assigned_due_date, assigned_planned_hours, planned_hours, actual_hours, risk_rating, control_frequency, testing_sample_size, source_payload",
      )
      .eq("audit_id", auditId)
      .returns<ControlRow[]>(),
    supabase
      .from("applications")
      .select("id, application_name, business_unit_id, criticality, hosting_model, lifecycle_status, vendor_name, source_payload")
      .eq("audit_id", auditId)
      .returns<ApplicationRow[]>(),
    supabase
      .from("third_parties")
      .select("id, third_party_name, business_unit_id, service_category, criticality, lifecycle_status, open_issues_count, source_payload")
      .eq("audit_id", auditId)
      .returns<ThirdPartyRow[]>(),
    supabase
      .from("rcsa_records")
      .select("id, business_unit_id, risk_statement, residual_risk_rating, key_controls, source_payload")
      .eq("audit_id", auditId)
      .returns<RcsaRow[]>(),
    supabase
      .from("issues")
      .select("id, issue_summary, status, severity, business_unit_id, target_remediation_date, root_cause, remediation_progress, source_payload")
      .eq("audit_id", auditId)
      .returns<IssueRow[]>(),
    supabase
      .from("monitoring_results")
      .select("id, title, summary, severity, status, business_unit_id, source_payload")
      .eq("audit_id", auditId)
      .returns<MonitoringRow[]>(),
    supabase
      .from("prior_audit_findings")
      .select("id, prior_audit_name, finding_description, status, severity, business_unit_id, source_payload")
      .eq("audit_id", auditId)
      .returns<PriorFindingRow[]>(),
    supabase
      .from("audit_documents")
      .select("id, document_type, title, status")
      .eq("audit_id", auditId)
      .returns<AuditDocumentRow[]>(),
  ]);

  const firstError = [
    auditResult.error,
    businessUnitsResult.error,
    controlsResult.error,
    applicationsResult.error,
    thirdPartiesResult.error,
    rcsaResult.error,
    issuesResult.error,
    monitoringResult.error,
    priorFindingsResult.error,
    documentsResult.error,
  ].find(Boolean);

  if (firstError) {
    throw new Error(firstError.message);
  }

  if (!auditResult.data) {
    throw new Error("Audit not found.");
  }

  return {
    applications: applicationsResult.data ?? [],
    audit: auditResult.data,
    auditDocuments: documentsResult.data ?? [],
    businessUnitMap: new Map((businessUnitsResult.data ?? []).map((unit) => [unit.id, unit.name])),
    controls: controlsResult.data ?? [],
    issues: issuesResult.data ?? [],
    monitoringResults: monitoringResult.data ?? [],
    priorAuditFindings: priorFindingsResult.data ?? [],
    rcsaRecords: rcsaResult.data ?? [],
    thirdParties: thirdPartiesResult.data ?? [],
  };
}

function buildTokenValues(context: NarrativeDataContext) {
  const currentPhase = normalizeAuditPhase(context.audit.active_phase);
  const controlCount = context.controls.length;
  const controlCountLabel = String(controlCount);
  const businessUnitsInScope = getDistinctBusinessUnits(context);
  const planningDocuments = context.auditDocuments.filter((document) =>
    document.document_type === "PLANNING_NARRATIVE" || document.document_type === "PLANNING_TOLLGATE",
  );
  const incompletePlanningDocuments = planningDocuments.filter((document) => document.status.trim().toLowerCase() !== "complete");
  const controlsWithAssignedOwnerCount = context.controls.filter((control) => control.assigned_owner_user_id !== null).length;
  const controlsWithBudgetCount = context.controls.filter((control) => control.assigned_planned_hours !== null).length;
  const controlsWithDueDateCount = context.controls.filter((control) => control.assigned_due_date !== null).length;
  const highRiskRcsas = context.rcsaRecords.filter((record) => normalizeRisk(record.residual_risk_rating) === "high");
  const mediumRiskRcsas = context.rcsaRecords.filter((record) => normalizeRisk(record.residual_risk_rating) === "medium");
  const highSeverityIssues = context.issues.filter((issue) => normalizeRisk(issue.severity) === "high");
  const highSeverityMonitoring = context.monitoringResults.filter((result) => normalizeRisk(result.severity) === "high");
  const highSeverityFindings = context.priorAuditFindings.filter((finding) => normalizeRisk(finding.severity) === "high");
  const missingPhaseBudgets = getMissingPhaseBudgetLabels(context.audit);
  const controlsMissingOwner = context.controls.filter((control) => control.assigned_owner_user_id === null).length;
  const controlsMissingBudget = context.controls.filter((control) => control.assigned_planned_hours === null).length;
  const controlsMissingDueDate = context.controls.filter((control) => control.assigned_due_date === null).length;
  const focusAreas = getAuditFocusAreas(context);
  const likelyProcedures = getLikelyProcedures(context);
  const evidenceExpectations = getEvidenceExpectations(context);
  const deepTestingAreas = getDeepTestingAreas(context);
  const targetedValidationAreas = getTargetedValidationAreas(context);
  const limitedScopeAreas = getLimitedScopeAreas(context);
  const planningHighlights = getPlanningSourceHighlights(context);
  const leadershipDecisionPoints = getLeadershipDecisionPoints(context);

  const values: Record<string, string> = {
    audit_name: context.audit.name,
    audit_period: formatAuditPeriod(context.audit.period_start, context.audit.period_end),
    current_phase: currentPhase,
    audit_status: context.audit.status,
    source_system: formatSourceSystem(context.audit.source_system),
    planning_narrative_summary: [
      `${context.audit.name} is currently in ${currentPhase.toLowerCase()} with ${controlCountLabel} in-scope controls across ${businessUnitsInScope.length} business units.`,
      highRiskRcsas.length > 0 || highSeverityIssues.length > 0 || highSeverityMonitoring.length > 0 || highSeverityFindings.length > 0
        ? `Imported planning data indicates elevated risk concentration in ${describeHighRiskThemes(context)}.`
        : "Imported planning data does not yet show concentrated high-risk themes, but readiness decisions still need to be finalized before execution.",
      incompletePlanningDocuments.length > 0 || controlsMissingOwner > 0 || controlsMissingBudget > 0 || controlsMissingDueDate > 0
        ? "Planning readiness is still dependent on closing setup gaps in ownership, budget, due dates, and core planning artifacts."
        : "Planning setup appears substantially complete and the audit is positioned to transition cleanly into fieldwork.",
    ].join(" "),
    audit_focus_areas: focusAreas.join(", "),
    business_units_in_scope: businessUnitsInScope.join(", "),
    control_count: controlCountLabel,
    business_context_summary: [
      businessUnitsInScope.length > 0
        ? `The current audit perimeter spans ${businessUnitsInScope.join(", ")}.`
        : "The audit perimeter is still being established from the imported record set.",
      context.applications.length > 0
        ? `${context.applications.length} application records contribute system context for the audit scope.`
        : "No application inventory records have been imported for this audit.",
      context.thirdParties.length > 0
        ? `${context.thirdParties.length} third-party records provide vendor and service dependency context relevant to the planning narrative.`
        : "No third-party dependency records have been imported for this audit.",
    ].join(" "),
    application_count: String(context.applications.length),
    third_party_count: String(context.thirdParties.length),
    rcsa_count: String(context.rcsaRecords.length),
    issue_count: String(context.issues.length),
    monitoring_result_count: String(context.monitoringResults.length),
    prior_finding_count: String(context.priorAuditFindings.length),
    planning_source_summary: [
      `${context.applications.length} applications, ${context.thirdParties.length} third parties, ${context.rcsaRecords.length} RCSA records, ${context.issues.length} issues, ${context.monitoringResults.length} monitoring results, and ${context.priorAuditFindings.length} prior findings were imported for planning analysis.`,
      context.rcsaRecords.length > 0
        ? `RCSA records and issue data provide the strongest direct indicators of residual risk and control pressure for the audit perimeter.`
        : "Current planning relies primarily on non-RCSA operational and issue inputs because risk self-assessment records are limited or absent.",
    ].join(" "),
    planning_source_highlights: planningHighlights,
    high_risk_theme_summary: describeHighRiskThemes(context),
    high_risk_rcsa_count: String(highRiskRcsas.length),
    medium_risk_rcsa_count: String(mediumRiskRcsas.length),
    rcsa_risk_detail:
      highRiskRcsas.length > 0
        ? highRiskRcsas
            .slice(0, 3)
            .map((record) => {
              const businessUnit = resolveBusinessUnit(context, record.business_unit_id);
              return `${businessUnit}: ${record.risk_statement}${record.key_controls.length > 0 ? ` Key controls include ${record.key_controls.join(", ")}.` : ""}`;
            })
            .join(" ")
        : "No high-risk RCSA records were imported for this audit. Residual risk conclusions should therefore be validated against issues, monitoring results, and prior findings.",
    issue_and_finding_summary: [
      context.issues.length > 0
        ? `Imported issues highlight themes such as ${context.issues.slice(0, 3).map((issue) => issue.issue_summary).join("; ")}.`
        : "No issue records were imported for this audit.",
      context.priorAuditFindings.length > 0
        ? `Prior findings reinforce planning attention in areas including ${context.priorAuditFindings
            .slice(0, 2)
            .map((finding) => finding.prior_audit_name)
            .join(" and ")}.`
        : "No prior audit findings were imported for this audit.",
    ].join(" "),
    monitoring_signal_summary:
      context.monitoringResults.length > 0
        ? `Monitoring results indicate current-state pressure from ${context.monitoringResults.slice(0, 3).map((result) => result.title).join(", ")}. These signals should inform where fieldwork depth is increased or where walkthroughs need more challenge.`
        : "No monitoring results were imported for this audit, so the planning narrative should rely more heavily on RCSA, issue, and prior-finding evidence.",
    controls_with_assigned_owner_count: String(controlsWithAssignedOwnerCount),
    controls_with_budget_count: String(controlsWithBudgetCount),
    controls_with_due_date_count: String(controlsWithDueDateCount),
    planning_readiness_summary: [
      `${controlsWithAssignedOwnerCount} of ${controlCount} controls have assigned audit owners, ${controlsWithBudgetCount} have budgeted hours set, and ${controlsWithDueDateCount} have committed dates.`,
      incompletePlanningDocuments.length > 0
        ? `${incompletePlanningDocuments.length} planning artifacts are still incomplete, which keeps planning readiness below full sign-off.`
        : "Core planning artifacts are complete.",
    ].join(" "),
    open_planning_gaps: toBulletList([
      controlsMissingOwner > 0 ? `${controlsMissingOwner} controls still need an assigned audit owner.` : null,
      controlsMissingBudget > 0 ? `${controlsMissingBudget} controls still need budgeted hours.` : null,
      controlsMissingDueDate > 0 ? `${controlsMissingDueDate} controls still need target dates.` : null,
      ...incompletePlanningDocuments.map((document) => `${document.title} remains ${formatStatus(document.status)}.`),
    ]),
    planning_budget_hours: formatBudgetHours(context.audit.planning_budget_hours),
    fieldwork_budget_hours: formatBudgetHours(context.audit.fieldwork_budget_hours),
    reporting_budget_hours: formatBudgetHours(context.audit.reporting_budget_hours),
    budget_narrative: [
      `Current phase budgets are set at planning ${formatBudgetHours(context.audit.planning_budget_hours)}, fieldwork ${formatBudgetHours(
        context.audit.fieldwork_budget_hours,
      )}, and reporting ${formatBudgetHours(context.audit.reporting_budget_hours)}.`,
      controlsMissingBudget > 0
        ? `Control-level hour setup is not yet complete because ${controlsMissingBudget} controls still lack assigned planned hours.`
        : "Control-level hour setup is fully aligned to the audit plan.",
    ].join(" "),
    budget_gap_summary:
      missingPhaseBudgets.length > 0 || controlsMissingBudget > 0
        ? [
            missingPhaseBudgets.length > 0 ? `Phase budgets still missing: ${missingPhaseBudgets.join(", ")}.` : null,
            controlsMissingBudget > 0 ? `${controlsMissingBudget} controls still need assigned planned hours.` : null,
          ]
            .filter(Boolean)
            .join(" ")
        : "Phase budgets and control-level planned hours are configured.",
    scope_focus_summary: [
      `Based on the imported planning data, the audit should focus on ${focusAreas.join(", ")}.`,
      deepTestingAreas.length > 0 ? `The strongest justification for deeper coverage comes from ${deepTestingAreas.slice(0, 3).join(", ")}.` : null,
    ]
      .filter(Boolean)
      .join(" "),
    deep_testing_areas: toBulletList(deepTestingAreas),
    targeted_validation_areas: toBulletList(targetedValidationAreas),
    out_of_scope_or_limited_scope_areas: toBulletList(limitedScopeAreas),
    audit_approach_summary: [
      `The audit approach should combine walkthroughs, targeted control testing, and evidence-based validation across ${controlCount} imported controls.`,
      context.applications.length > 0 ? "Application context should be used to confirm system boundaries and integration points." : null,
      context.thirdParties.length > 0 ? "Third-party records should inform targeted validation of dependency and oversight controls." : null,
    ]
      .filter(Boolean)
      .join(" "),
    likely_procedures: toBulletList(likelyProcedures),
    evidence_expectations: toBulletList(evidenceExpectations),
    planning_dependencies: toBulletList([
      controlsMissingOwner > 0 ? `Assign audit owners to the remaining ${controlsMissingOwner} controls.` : null,
      controlsMissingBudget > 0 ? `Set planned hours for the remaining ${controlsMissingBudget} controls.` : null,
      controlsMissingDueDate > 0 ? `Set target dates for the remaining ${controlsMissingDueDate} controls.` : null,
      ...incompletePlanningDocuments.map((document) => `Complete ${document.title}.`),
    ]),
    planning_assumptions: toBulletList([
      `The audit will remain in ${currentPhase.toLowerCase()} until planning setup and documentation are complete.`,
      context.applications.length > 0 ? "Imported application inventory accurately reflects the systems relevant to the audit perimeter." : null,
      context.thirdParties.length > 0 ? "Imported third-party records reflect the key vendor dependencies in scope." : null,
    ]),
    pre_fieldwork_open_items: toBulletList([
      controlsMissingOwner > 0 ? `${controlsMissingOwner} controls are still missing assigned ownership.` : null,
      controlsMissingBudget > 0 ? `${controlsMissingBudget} controls are still missing planned hours.` : null,
      controlsMissingDueDate > 0 ? `${controlsMissingDueDate} controls are still missing due dates.` : null,
      ...context.issues
        .filter((issue) => issue.status.trim().toLowerCase() !== "completed")
        .slice(0, 3)
        .map((issue) => `Review planning implication of issue: ${issue.issue_summary}.`),
    ]),
    leadership_decision_points: toBulletList(leadershipDecisionPoints),
    conclusion_summary: [
      currentPhase === "Planning"
        ? "planning remains focused on converting imported risk signals into a defensible scope and fully configured execution plan"
        : `the audit has progressed beyond planning but still relies on the imported planning record to justify scope and risk focus`,
      controlsMissingOwner > 0 || controlsMissingBudget > 0 || controlsMissingDueDate > 0 || incompletePlanningDocuments.length > 0
        ? "several readiness gaps remain open"
        : "core readiness items appear substantially complete",
      deepTestingAreas.length > 0 ? `the strongest areas for deeper testing are ${deepTestingAreas.slice(0, 2).join(" and ")}` : null,
    ]
      .filter(Boolean)
      .join(", "),
  };

  return values;
}

function renderPlanningNarrativeTemplate(template: string, tokenValues: Record<string, string>) {
  return template.replace(/\{\{([a-z0-9_]+)\}\}/gi, (_, token: string) => tokenValues[token] ?? `{{${token}}}`);
}

function getDistinctBusinessUnits(context: NarrativeDataContext) {
  const names = new Set<string>();

  for (const control of context.controls) {
    names.add(resolveBusinessUnit(context, control.business_unit_id));
  }

  for (const application of context.applications) {
    names.add(resolveBusinessUnit(context, application.business_unit_id));
  }

  for (const thirdParty of context.thirdParties) {
    names.add(resolveBusinessUnit(context, thirdParty.business_unit_id));
  }

  for (const rcsa of context.rcsaRecords) {
    names.add(resolveBusinessUnit(context, rcsa.business_unit_id));
  }

  return [...names].filter((name) => name !== "Unassigned");
}

function resolveBusinessUnit(context: NarrativeDataContext, businessUnitId: string | null) {
  if (!businessUnitId) {
    return "Unassigned";
  }

  return context.businessUnitMap.get(businessUnitId) ?? "Unassigned";
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

function normalizeRisk(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function describeHighRiskThemes(context: NarrativeDataContext) {
  const themes = [
    ...context.rcsaRecords
      .filter((record) => normalizeRisk(record.residual_risk_rating) === "high")
      .slice(0, 3)
      .map((record) => `${resolveBusinessUnit(context, record.business_unit_id)} RCSA risk`),
    ...context.issues
      .filter((issue) => normalizeRisk(issue.severity) === "high")
      .slice(0, 2)
      .map((issue) => issue.issue_summary),
    ...context.monitoringResults
      .filter((result) => normalizeRisk(result.severity) === "high")
      .slice(0, 2)
      .map((result) => result.title),
    ...context.priorAuditFindings
      .filter((finding) => normalizeRisk(finding.severity) === "high")
      .slice(0, 2)
      .map((finding) => finding.prior_audit_name),
  ];

  return dedupe(themes).slice(0, 5).join(", ") || "no concentrated high-risk themes were identified in the imported record set";
}

function getAuditFocusAreas(context: NarrativeDataContext) {
  return dedupe([
    ...context.controls.slice(0, 4).map((control) => control.control_name),
    ...context.rcsaRecords.slice(0, 2).map((record) => record.risk_statement),
  ]).slice(0, 5);
}

function getPlanningSourceHighlights(context: NarrativeDataContext) {
  const highlights = [
    ...context.applications
      .slice(0, 2)
      .map((application) => `Application context: ${application.application_name}${application.criticality ? ` (${application.criticality})` : ""}`),
    ...context.thirdParties
      .slice(0, 2)
      .map((thirdParty) => `Third-party context: ${thirdParty.third_party_name}${thirdParty.service_category ? ` (${thirdParty.service_category})` : ""}`),
    ...context.issues.slice(0, 2).map((issue) => `Issue theme: ${issue.issue_summary}`),
    ...context.monitoringResults.slice(0, 2).map((result) => `Monitoring signal: ${result.title}`),
    ...context.priorAuditFindings.slice(0, 2).map((finding) => `Prior finding: ${finding.prior_audit_name}`),
  ];

  return toBulletList(highlights.slice(0, 6));
}

function getMissingPhaseBudgetLabels(audit: AuditRow) {
  const missing: string[] = [];

  if (audit.planning_budget_hours === null) {
    missing.push("Planning");
  }

  if (audit.fieldwork_budget_hours === null) {
    missing.push("Fieldwork");
  }

  if (audit.reporting_budget_hours === null) {
    missing.push("Reporting");
  }

  return missing;
}

function getDeepTestingAreas(context: NarrativeDataContext) {
  return dedupe([
    ...context.rcsaRecords
      .filter((record) => normalizeRisk(record.residual_risk_rating) === "high")
      .map((record) => record.risk_statement),
    ...context.issues.filter((issue) => normalizeRisk(issue.severity) === "high").map((issue) => issue.issue_summary),
    ...context.monitoringResults.filter((result) => normalizeRisk(result.severity) === "high").map((result) => result.title),
    ...context.priorAuditFindings
      .filter((finding) => normalizeRisk(finding.severity) === "high")
      .map((finding) => finding.finding_description),
  ]).slice(0, 5);
}

function getTargetedValidationAreas(context: NarrativeDataContext) {
  return dedupe([
    ...context.thirdParties
      .filter((thirdParty) => normalizeRisk(thirdParty.criticality) === "medium")
      .map((thirdParty) => thirdParty.third_party_name),
    ...context.applications
      .filter((application) => normalizeRisk(application.criticality) === "medium")
      .map((application) => application.application_name),
    ...context.rcsaRecords
      .filter((record) => normalizeRisk(record.residual_risk_rating) === "medium")
      .map((record) => record.risk_statement),
  ]).slice(0, 5);
}

function getLimitedScopeAreas(context: NarrativeDataContext) {
  const candidates = dedupe([
    ...context.applications
      .filter((application) => normalizeRisk(application.criticality) === "low" || application.lifecycle_status?.toLowerCase() === "stable")
      .map((application) => application.application_name),
    ...context.thirdParties
      .filter((thirdParty) => thirdParty.open_issues_count === 0 && normalizeRisk(thirdParty.criticality) !== "high")
      .map((thirdParty) => thirdParty.third_party_name),
  ]).slice(0, 5);

  return candidates.length > 0 ? candidates : ["No clear limited-scope areas were identified from the imported planning data."];
}

function getLikelyProcedures(context: NarrativeDataContext) {
  const procedures = [
    ...context.controls.slice(0, 4).map((control) => `Walk through and test control: ${control.control_name}.`),
    context.applications.length > 0 ? "Confirm application boundaries, integrations, and system ownership for in-scope processes." : null,
    context.thirdParties.length > 0 ? "Validate oversight and dependency controls for critical third parties." : null,
    context.monitoringResults.length > 0 ? "Inspect operational monitoring outputs for current-state exception patterns and escalation signals." : null,
  ];

  return procedures.filter((value): value is string => Boolean(value));
}

function getEvidenceExpectations(context: NarrativeDataContext) {
  const evidence = [
    "Current control inventory and assigned ownership details.",
    "Budgeted hours, target dates, and planning package status.",
    context.applications.length > 0 ? "Application inventory extracts and system context artifacts." : null,
    context.thirdParties.length > 0 ? "Vendor oversight records, due diligence support, or dependency trackers." : null,
    context.monitoringResults.length > 0 ? "Monitoring outputs, exception logs, and trend reports." : null,
    context.issues.length > 0 ? "Issue trackers, remediation updates, and root-cause support." : null,
  ];

  return evidence.filter((value): value is string => Boolean(value));
}

function getLeadershipDecisionPoints(context: NarrativeDataContext) {
  const points = [
    ...getDeepTestingAreas(context).slice(0, 3).map((area) => `Confirm whether ${area} requires deeper testing during fieldwork.`),
    getMissingPhaseBudgetLabels(context.audit).length > 0
      ? `Approve remaining phase budgets for ${getMissingPhaseBudgetLabels(context.audit).join(", ")}.`
      : null,
    context.auditDocuments.some((document) => document.document_type === "PLANNING_TOLLGATE" && document.status.trim().toLowerCase() !== "complete")
      ? "Confirm expectations and timing for the planning tollgate package."
      : null,
  ];

  return points.filter((value): value is string => Boolean(value));
}

function toBulletList(items: Array<string | null | undefined>) {
  const normalized = items.map((item) => item?.trim()).filter((item): item is string => Boolean(item && item.length > 0));

  if (normalized.length === 0) {
    return "- None currently identified.";
  }

  return normalized.map((item) => `- ${item}`).join("\n");
}

function dedupe(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function formatBudgetHours(value: number | null) {
  return value === null ? "Not set" : `${Number(value).toFixed(0)}h`;
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

function formatStatus(value: string) {
  return value.trim().replaceAll("_", " ").toLowerCase();
}
