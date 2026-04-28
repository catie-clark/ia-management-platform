import { readFile } from "node:fs/promises";
import path from "node:path";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getFieldworkViewModel } from "@/lib/fieldwork-data";
import type { AuditFindingRow } from "@/lib/live-audit";
import { formatDateTime, formatHours } from "@/lib/utils";

export type FieldworkTollgateViewModel = {
  auditId: string;
  missingRequiredTokens: string[];
  renderedTemplate: string;
  template: string;
  tokenValues: Record<string, string>;
};

type FieldworkFinding = {
  dueDate?: string;
  impactStatement?: string;
  managementResponse?: string;
  severity: string;
  summary: string;
  title: string;
};

export async function getFieldworkTollgateViewModel(auditId: string): Promise<FieldworkTollgateViewModel> {
  const template = await loadFieldworkTollgateTemplate();
  const fieldworkViewModel = await getFieldworkViewModel({ auditId, mode: "live" });
  const findings = await loadAuditFindings(auditId);
  const tokenValues = buildTokenValues({
    auditId,
    auditLabel: fieldworkViewModel.auditLabel,
    auditPeriodLabel: fieldworkViewModel.auditPeriodLabel,
    auditStatus: fieldworkViewModel.auditStatus,
    currentPhase: fieldworkViewModel.currentPhase,
    controls: fieldworkViewModel.controls,
    documents: fieldworkViewModel.documents,
    findings,
    questions: fieldworkViewModel.questions,
    requests: fieldworkViewModel.requests,
  });
  const renderedTemplate = renderFieldworkTollgateTemplate(template, tokenValues);
  const missingRequiredTokens = Object.entries(tokenValues)
    .filter(([, value]) => value.trim().length === 0)
    .map(([key]) => key)
    .filter((token) => renderedTemplate.includes(`{{${token}}}`));

  return {
    auditId,
    missingRequiredTokens,
    renderedTemplate,
    template,
    tokenValues,
  };
}

async function loadFieldworkTollgateTemplate() {
  const templatePath = path.join(process.cwd(), "src", "lib", "fieldwork-tollgate", "template.md");
  return readFile(templatePath, "utf8");
}

async function loadAuditFindings(auditId: string): Promise<FieldworkFinding[]> {
  const supabase = createSupabaseAdminClient();

  try {
    const { data, error } = await supabase
      .from("audit_findings")
      .select("id, title, summary, severity, due_date, impact_statement, management_response, updated_at")
      .eq("audit_id", auditId)
      .order("updated_at", { ascending: true })
      .returns<
        Array<
          Pick<
            AuditFindingRow,
            "id" | "title" | "summary" | "severity" | "due_date" | "impact_statement" | "management_response" | "updated_at"
          >
        >
      >();

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((finding) => ({
      dueDate: finding.due_date ?? undefined,
      impactStatement: finding.impact_statement ?? undefined,
      managementResponse: finding.management_response ?? undefined,
      severity: finding.severity,
      summary: finding.summary,
      title: finding.title,
    }));
  } catch (error) {
    if (error instanceof Error && error.message.includes("audit_findings")) {
      return [];
    }

    throw error;
  }
}

function renderFieldworkTollgateTemplate(template: string, tokenValues: Record<string, string>) {
  return template.replace(/\{\{([a-z0-9_]+)\}\}/gi, (_, token: string) => tokenValues[token] ?? `{{${token}}}`);
}

function buildTokenValues(args: {
  auditId: string;
  auditLabel: string;
  auditPeriodLabel: string;
  auditStatus: string;
  currentPhase: string;
  controls: Awaited<ReturnType<typeof getFieldworkViewModel>>["controls"];
  documents: Awaited<ReturnType<typeof getFieldworkViewModel>>["documents"];
  findings: FieldworkFinding[];
  questions: Awaited<ReturnType<typeof getFieldworkViewModel>>["questions"];
  requests: Awaited<ReturnType<typeof getFieldworkViewModel>>["requests"];
}) {
  const workpapers = args.documents.filter((document) => document.type === "WORKPAPER");
  const evidenceItems = args.documents.filter((document) => document.type === "EVIDENCE");
  const completedControls = args.controls.filter((control) => control.status === "COMPLETE");
  const blockedControls = args.controls.filter((control) => control.status === "BLOCKED");
  const activeControls = args.controls.filter((control) => control.status !== "COMPLETE");
  const openQuestions = args.questions.filter((question) => question.status !== "RESPONDED");
  const openRequests = args.requests.filter((request) => request.status !== "COMPLETED");
  const approvedWorkpapers = workpapers.filter((document) => document.reviewStatus === "APPROVED");
  const plannedHoursTotal = args.controls.reduce((sum, control) => sum + control.plannedHours, 0);
  const actualHoursTotal = args.controls.reduce((sum, control) => sum + control.actualHours, 0);
  const hourVariance = actualHoursTotal - plannedHoursTotal;
  const overdueDocuments = args.documents.filter((document) => document.dueDate && new Date(document.dueDate).getTime() < Date.now());
  const scopeDeviationControls = args.controls.filter(
    (control) => control.scopeStatus === "OUT_OF_SCOPE" || control.hasPlanningOverride || Boolean(control.planningOverriddenAt),
  );

  return {
    audit_name: args.auditLabel,
    audit_period: args.auditPeriodLabel,
    current_phase: args.currentPhase,
    audit_status: args.auditStatus,
    fieldwork_status_summary: [
      `${args.controls.length} controls, ${workpapers.length} workpapers, and ${evidenceItems.length} evidence items are currently associated with this audit.`,
      `${completedControls.length} controls are complete, ${activeControls.length} remain open, and ${blockedControls.length} are blocked.`,
      `${approvedWorkpapers.length} workpapers have completed review and ${workpapers.length - approvedWorkpapers.length} remain in authoring or review status.`,
    ].join(" "),
    procedure_completion_summary: [
      `- Planned control population under fieldwork: ${args.controls.length}`,
      `- Controls complete: ${completedControls.length}`,
      `- Controls still active or incomplete: ${activeControls.length}`,
      `- Workpapers drafted: ${workpapers.length}`,
      `- Evidence artifacts linked: ${evidenceItems.length}`,
    ].join("\n"),
    open_item_summary:
      blockedControls.length > 0 || openQuestions.length > 0 || openRequests.length > 0 || overdueDocuments.length > 0
        ? [
            blockedControls.length > 0 ? `- ${blockedControls.length} blocked controls still require resolution or explicit carryforward rationale.` : "",
            openQuestions.length > 0 ? `- ${openQuestions.length} open questions remain outstanding.` : "",
            openRequests.length > 0 ? `- ${openRequests.length} open requests remain outstanding.` : "",
            overdueDocuments.length > 0 ? `- ${overdueDocuments.length} fieldwork documents are past due and should be explained in the tollgate discussion.` : "",
          ]
            .filter(Boolean)
            .join("\n")
        : "No material open fieldwork items are currently recorded.",
    findings_overview:
      args.findings.length > 0
        ? `${args.findings.length} draft findings are currently recorded for leadership review before reporting begins.`
        : "No draft findings are currently recorded in the audit record.",
    findings_inventory:
      args.findings.length > 0
        ? args.findings
            .map(
              (finding, index) =>
                `- F-${String(index + 1).padStart(2, "0")} ${finding.title}. Condition: ${finding.summary}. Criteria: Criteria detail not yet captured in the current record. Cause: Cause detail not yet captured in the current record. Effect/Risk: ${finding.impactStatement ?? "Effect or risk detail not yet captured in the current record."}. Preliminary severity: ${finding.severity}.`,
            )
            .join("\n")
        : "No draft findings have been entered yet.",
    evidence_sufficiency_statement: `Based on the current fieldwork record, the audit team represents that sufficient, reliable, and relevant evidence has been gathered to support the draft conclusions reflected here, consistent with IIA Standard 2310, subject to any open items listed in this tollgate draft.`,
    evidence_coverage_summary:
      workpapers.length > 0 || evidenceItems.length > 0
        ? [
            `- Workpapers available: ${workpapers.length}`,
            `- Workpapers approved: ${approvedWorkpapers.length}`,
            `- Evidence items linked: ${evidenceItems.length}`,
            `- Controls with completed execution status: ${completedControls.length}`,
          ].join("\n")
        : "No workpaper or evidence coverage has been recorded yet.",
    scope_deviation_summary:
      scopeDeviationControls.length > 0
        ? scopeDeviationControls
            .map(
              (control) =>
                `- ${control.referenceId ?? control.id} ${control.name}: scope posture is ${control.scopeStatus.replaceAll("_", " ").toLowerCase()}${control.planningOverriddenAt ? `, with a planning override recorded on ${formatDateTime(control.planningOverriddenAt)}` : ""}.`,
            )
            .join("\n")
        : "No explicit deviations from the approved scope are currently recorded in the audit data.",
    preliminary_management_response_summary:
      args.findings.some((finding) => finding.managementResponse)
        ? args.findings
            .filter((finding) => finding.managementResponse)
            .map((finding) => `- ${finding.title}: ${finding.managementResponse}`)
            .join("\n")
        : "Preliminary management responses have not yet been captured for the current draft findings.",
    resource_timeline_status: [
      `- Planned hours: ${formatHours(plannedHoursTotal)}`,
      `- Actual hours: ${formatHours(actualHoursTotal)}`,
      `- Variance: ${hourVariance >= 0 ? "+" : ""}${formatHours(hourVariance)}`,
      hourVariance > 0
        ? "- Actual effort is currently above plan and should be explained before reporting begins."
        : "- Actual effort is currently within or below plan based on recorded fieldwork hours.",
    ].join("\n"),
    schedule_status_summary:
      overdueDocuments.length > 0
        ? `There are ${overdueDocuments.length} overdue fieldwork documents on the current record. Leadership should confirm whether these affect reporting readiness.`
        : "No overdue fieldwork documents are currently recorded.",
    proceed_recommendation:
      blockedControls.length > 0 || openQuestions.length > 0 || openRequests.length > 0
        ? `The engagement lead recommends moving to reporting only after leadership reviews the open fieldwork items summarized above and confirms they do not undermine the supportability of the draft findings.`
        : `The engagement lead recommends that the audit proceed to reporting because fieldwork is substantially complete and the recorded evidence base is sufficient to support draft conclusions.`,
  };
}
