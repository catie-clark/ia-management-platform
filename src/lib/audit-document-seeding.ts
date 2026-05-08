import { buildNarrativePreview } from "@/lib/planning-narrative/format";
import { buildArtifactDraft, reportArtifactConfigs } from "@/lib/reporting";
import { getReportArtifactSourceRecordKey } from "@/lib/reporting-persistence";
import { findPlanningArtifactOwner } from "@/lib/planning-artifact-persistence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AuditDocument, ReportArtifactKey } from "@/types/audit";

type SeededDocumentConfig = {
  documentType: AuditDocument["type"];
  markdown: (auditName: string) => string;
  sourceRecordKey: (auditId: string) => string;
  templateName: string;
  title: string;
  sourcePayload: (auditName: string) => Record<string, unknown>;
};

const planningNarrativeConfig: SeededDocumentConfig = {
  documentType: "PLANNING_NARRATIVE",
  markdown: buildPlanningNarrativeMarkdown,
  sourceRecordKey: (auditId) => `planning-narrative-${auditId}`,
  templateName: "System Planning Narrative Template",
  title: "Planning Narrative Draft",
  sourcePayload: (auditName) => buildPlanningPayload(buildPlanningNarrativeMarkdown(auditName)),
};

const planningTollgateConfig: SeededDocumentConfig = {
  documentType: "PLANNING_TOLLGATE",
  markdown: buildPlanningTollgateMarkdown,
  sourceRecordKey: (auditId) => `planning-tollgate-${auditId}`,
  templateName: "System Planning Tollgate Template",
  title: "Planning Tollgate Draft",
  sourcePayload: (auditName) => buildPlanningPayload(buildPlanningTollgateMarkdown(auditName)),
};

const fieldworkTollgateConfig: SeededDocumentConfig = {
  documentType: "FIELDWORK_TOLLGATE",
  markdown: buildFieldworkTollgateMarkdown,
  sourceRecordKey: (auditId) => `fieldwork-tollgate-${auditId}`,
  templateName: "System Fieldwork Tollgate Template",
  title: "Fieldwork Tollgate Draft",
  sourcePayload: (auditName) => buildPlanningPayload(buildFieldworkTollgateMarkdown(auditName)),
};

const reportingArtifactConfigsToSeed: ReportArtifactKey[] = ["FINAL_REPORT", "REPORTING_TOLLGATE"];

export async function ensureStandardAuditDocuments(args: { auditId: string; auditName: string }) {
  const supabase = createSupabaseAdminClient();
  const owner = await findPlanningArtifactOwner(args.auditId);
  const documents = [
    buildSeededPlanningDocument(args.auditId, args.auditName, owner?.id ?? null, planningNarrativeConfig),
    buildSeededPlanningDocument(args.auditId, args.auditName, owner?.id ?? null, planningTollgateConfig),
    buildSeededPlanningDocument(args.auditId, args.auditName, owner?.id ?? null, fieldworkTollgateConfig),
    ...reportingArtifactConfigsToSeed.map((artifactKey) =>
      buildSeededReportingDocument(args.auditId, args.auditName, owner?.id ?? null, artifactKey),
    ),
  ];

  const { error } = await supabase.from("audit_documents").upsert(documents, { onConflict: "source_record_key" });

  if (error) {
    throw new Error(error.message);
  }
}

function buildPlanningNarrativeMarkdown(auditName: string) {
  return [
    "# Planning Narrative Draft",
    "",
    "## Purpose",
    `This standard planning narrative template has been created for ${auditName}. Update it as planning data, scope decisions, and audit rationale are finalized.`,
    "",
    "## Scope and Risk Context",
    "- Document the core risks, focus areas, and rationale for scope decisions.",
    "",
    "## Planning Readiness",
    "- Summarize key planning dependencies, budget assumptions, and open setup items before fieldwork.",
    "",
    "## Leadership Decisions",
    "- Capture approvals, scope pivots, or resourcing decisions needed before the planning tollgate closes.",
  ].join("\n");
}

function buildPlanningTollgateMarkdown(auditName: string) {
  return [
    "# Planning Tollgate Draft",
    "",
    "## Purpose",
    `This standard planning tollgate template has been created for ${auditName}. Use it to document readiness to move from planning into fieldwork.`,
    "",
    "## Entry Criteria",
    "- Confirm scope, timeline, budget, staffing, and key data dependencies.",
    "",
    "## Risks to Fieldwork Start",
    "- Capture unresolved blockers that could delay fieldwork or weaken execution quality.",
    "",
    "## Tollgate Decision",
    "- Record the final GO / NO-GO decision and required follow-up items.",
  ].join("\n");
}

function buildFieldworkTollgateMarkdown(auditName: string) {
  return [
    "# Fieldwork Tollgate Draft",
    "",
    "## Purpose",
    `This standard fieldwork tollgate template has been created for ${auditName}. Update it as testing concludes and the team prepares to move into reporting.`,
    "",
    "## Execution Summary",
    "- Summarize control testing progress, exceptions, and unresolved dependencies.",
    "",
    "## Readiness to Report",
    "- Confirm whether workpapers, evidence, and open questions support transition into reporting.",
    "",
    "## Tollgate Decision",
    "- Record the GO / NO-GO decision and any required remediation before reporting starts.",
  ].join("\n");
}

function buildPlanningPayload(markdown: string) {
  const preview = buildNarrativePreview(markdown);

  return {
    generated_at: new Date().toISOString(),
    generated_markdown: markdown,
    preview_sections: preview.previewSections,
    preview_summary: preview.previewSummary,
    review_status: "NOT_SUBMITTED",
  };
}

function buildSeededPlanningDocument(
  auditId: string,
  auditName: string,
  ownerUserId: string | null,
  config: SeededDocumentConfig,
) {
  return {
    audit_id: auditId,
    document_type: config.documentType,
    owner_user_id: ownerUserId,
    source_payload: config.sourcePayload(auditName),
    source_record_key: config.sourceRecordKey(auditId),
    source_system: "platform",
    status: "not_started",
    template_name: config.templateName,
    title: config.title,
  };
}

function buildSeededReportingDocument(
  auditId: string,
  auditName: string,
  ownerUserId: string | null,
  artifactKey: ReportArtifactKey,
) {
  const markdown =
    artifactKey === "FINAL_REPORT"
      ? [
          "# Final Audit Report Draft",
          "",
          "## Executive Summary",
          `This standard final report template has been created for ${auditName}. Update the narrative after fieldwork results and observations are finalized.`,
          "",
          "## Scope, Objectives, and Methodology",
          "- Document the final scope, objectives, testing approach, and any scope limitations.",
          "",
          "## Conclusions and Observations",
          "- Summarize final conclusions, linked support, ratings, and management actions.",
        ].join("\n")
      : [
          "# Reporting Tollgate Draft",
          "",
          "## Purpose",
          `This standard reporting tollgate template has been created for ${auditName}. Use it to confirm report-package readiness before issuance.`,
          "",
          "## Report Readiness",
          "- Confirm workpapers, evidence, findings, and management responses are ready for issuance.",
          "",
          "## Approval Decision",
          "- Record the GO / NO-GO decision and any final blockers to issuance.",
        ].join("\n");
  const preview = buildArtifactDraft(
    markdown,
    artifactKey === "FINAL_REPORT"
      ? "Standard final report shell created for this audit."
      : "Standard reporting tollgate shell created for this audit.",
  );
  const config = reportArtifactConfigs[artifactKey];

  return {
    audit_id: auditId,
    document_type: config.documentType,
    owner_user_id: ownerUserId,
    source_payload: {
      artifact_key: artifactKey,
      generated_at: new Date().toISOString(),
      generated_markdown: markdown,
      preview_sections: preview.previewSections,
      preview_summary: preview.previewSummary,
      review_status: "NOT_SUBMITTED",
    },
    source_record_key: getReportArtifactSourceRecordKey(artifactKey, auditId),
    source_system: "platform",
    status: "not_started",
    template_name: config.templateName,
    title: config.title,
  };
}
