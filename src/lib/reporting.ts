import { buildNarrativePreview } from "@/lib/planning-narrative/format";
import {
  getQuestionDisplayStatus,
  getQuestionRealizedDelayHours,
  getRequestDisplayStatus,
  getRequestRealizedDelayHours,
} from "@/lib/audit-logic";
import { formatHours, formatShortDate } from "@/lib/utils";
import type {
  AuditDocument,
  AuditFinding,
  Control,
  Question,
  ReportArtifactKey,
  ReportReviewComment,
  ReportReviewStage,
  Request,
  Role,
  User,
} from "@/types/audit";

export const reportArtifactConfigs: Record<
  ReportArtifactKey,
  { documentType: AuditDocument["type"]; sourceRecordKeyPrefix: string; title: string; templateName: string }
> = {
  FINAL_REPORT: {
    documentType: "REPORT",
    sourceRecordKeyPrefix: "final-report",
    title: "Final Audit Report",
    templateName: "System Internal Audit Report Template",
  },
  REPORTING_TOLLGATE: {
    documentType: "TOLLGATE",
    sourceRecordKeyPrefix: "reporting-tollgate",
    title: "Reporting Tollgate Deck",
    templateName: "System Reporting Tollgate Template",
  },
};

export const defaultReportReviewRoles: Role[] = ["AIC", "MANAGER", "DIRECTOR", "CAE"];

type ReportingNarrativeContext = {
  auditLabel: string;
  controls: Control[];
  findings: AuditFinding[];
  now: string;
  questions: Question[];
  requests: Request[];
  users: User[];
};

export function buildPrototypeFindings(controls: Control[]): AuditFinding[] {
  const sourceControls = controls.filter((control) => control.status !== "COMPLETE").slice(0, 3);

  return sourceControls.map((control, index) => ({
    id: `F-${String(index + 1).padStart(2, "0")}`,
    displayId: `F-${String(index + 1).padStart(2, "0")}`,
    linkedControlId: control.id,
    title:
      index === 0
        ? "Control execution and approval evidence remain inconsistent"
        : index === 1
          ? "Exception resolution is lagging the expected operating cadence"
          : "Supporting evidence remains incomplete for final conclusion drafting",
    summary: `${control.name} remains ${control.status.replaceAll("_", " ").toLowerCase()} and is influencing the reporting narrative.`,
    severity: control.riskLevel,
    status: index === 0 ? "READY_FOR_REPORT" : index === 1 ? "IN_PROGRESS" : "OPEN",
    ownerId: control.ownerId,
    dueDate: control.dueDate,
    impactStatement: `If unresolved, ${control.businessUnit} conclusions may require elevated wording in the report.`,
    recommendation: `Finalize the remaining work on ${control.name.toLowerCase()} and document the root cause clearly in the report package.`,
    managementResponse: index === 0 ? "Management is assembling final support and expects closure before issuance." : undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

export function buildPrototypeReviewStages(artifactKey: ReportArtifactKey): ReportReviewStage[] {
  return defaultReportReviewRoles.map((role, index) => ({
    id: `${artifactKey}-${role}`,
    artifactKey,
    stageOrder: index + 1,
    reviewerRole: role,
    status: index === 0 ? "ACTIVE" : "PENDING",
  }));
}

export function buildPrototypeReviewComments(): ReportReviewComment[] {
  return [
    {
      id: "CMT-01",
      artifactKey: "FINAL_REPORT",
      authorRole: "MANAGER",
      authorName: "Elena Martin",
      comment: "Tighten the summary language around the blocked sanctions testing before advancing the draft.",
      status: "OPEN",
      createdAt: new Date().toISOString(),
    },
  ];
}

export function createReportDraftMarkdown(context: ReportingNarrativeContext) {
  const openControls = context.controls.filter((control) => control.status !== "COMPLETE");
  const highSeverityFindings = context.findings.filter((finding) => finding.severity === "HIGH");
  const openFollowUps =
    context.questions.filter((question) => getQuestionDisplayStatus(question, context.now) !== "RESPONDED").length +
    context.requests.filter((request) => getRequestDisplayStatus(request, context.now) !== "COMPLETED").length;

  return [
    "# Internal Audit Report Draft",
    "",
    "## Executive Summary",
    `${context.auditLabel} is in reporting closeout. ${context.findings.length} findings are currently being managed, with ${highSeverityFindings.length} assessed as high severity.`,
    "",
    "## Results Summary",
    `- Controls complete: ${context.controls.filter((control) => control.status === "COMPLETE").length}`,
    `- Controls still open: ${openControls.length}`,
    `- Findings finalized: ${context.findings.filter((finding) => finding.status === "FINALIZED" || finding.status === "CLOSED").length}`,
    `- Open follow-ups: ${openFollowUps}`,
    "",
    "## Key Findings",
    ...(context.findings.length > 0
      ? context.findings.map((finding) => `- ${finding.displayId ?? finding.id}: ${finding.title} (${finding.severity.toLowerCase()} severity, ${finding.status.replaceAll("_", " ").toLowerCase()})`)
      : ["- No findings have been drafted yet."]),
    "",
    "## Operational Themes",
    ...(openControls.slice(0, 3).map((control) => `- ${control.name}: ${control.businessUnit} work remains ${control.status.replaceAll("_", " ").toLowerCase()}.`) || [
      "- No open control themes remain.",
    ]),
    "",
    "## Management Response Snapshot",
    ...(context.findings.some((finding) => finding.managementResponse)
      ? context.findings
          .filter((finding) => finding.managementResponse)
          .map((finding) => `- ${finding.displayId ?? finding.id}: ${finding.managementResponse}`)
      : ["- Management responses have not yet been captured for this draft."]),
    "",
    "## Issuance Readiness",
    `The report package should not be issued until all required review stages are approved and remaining open follow-ups are addressed or explicitly accepted in the reporting narrative.`,
  ].join("\n");
}

export function createReportingTollgateMarkdown(context: ReportingNarrativeContext) {
  const totalCurrentDelay =
    context.questions.reduce((sum, question) => sum + getQuestionRealizedDelayHours(question), 0) +
    context.requests.reduce((sum, request) => sum + getRequestRealizedDelayHours(request), 0);

  return [
    "# Reporting Tollgate Draft",
    "",
    "## Closeout Posture",
    `${context.auditLabel} is preparing the report package for final review. ${context.findings.length} findings are in scope for the tollgate discussion.`,
    "",
    "## Decision Points",
    `- Finalize the report narrative around ${context.findings.filter((finding) => finding.status !== "CLOSED").length} still-active findings.`,
    `- Confirm review workflow progression through ${defaultReportReviewRoles.join(", ")}.`,
    `- Determine whether remaining follow-up delays of ${formatHours(totalCurrentDelay)} require escalation in the tollgate discussion.`,
    "",
    "## Findings Needing Leadership Attention",
    ...(context.findings.length > 0
      ? context.findings
          .filter((finding) => finding.severity === "HIGH" || finding.status !== "CLOSED")
          .slice(0, 5)
          .map((finding) => `- ${finding.displayId ?? finding.id}: ${finding.title}`)
      : ["- No findings have been entered yet."]),
    "",
    "## Document Readiness",
    `Leadership should confirm that the final report draft, reporting tollgate deck, and linked support are current before issuance.`,
  ].join("\n");
}

export function buildArtifactDraft(markdown: string, fallbackSummary: string) {
  const preview = buildNarrativePreview(markdown);

  return {
    markdown,
    previewSections: preview.previewSections,
    previewSummary: preview.previewSummary || fallbackSummary,
  };
}

export function getActiveReviewStage(stages: ReportReviewStage[]) {
  return stages.find((stage) => stage.status === "ACTIVE" || stage.status === "SENT_BACK") ?? null;
}

export function getWorkflowCompletionState(stages: ReportReviewStage[]) {
  return stages.length > 0 && stages.every((stage) => stage.status === "APPROVED");
}

export function canRoleActOnStage(role: Role, stage: ReportReviewStage | null) {
  return Boolean(stage) && stage!.reviewerRole === role && (stage!.status === "ACTIVE" || stage!.status === "SENT_BACK");
}

export function getArtifactDocument(
  documents: AuditDocument[],
  artifactKey: ReportArtifactKey,
  fallbackType: AuditDocument["type"],
) {
  return (
    documents.find((document) => document.artifactKey === artifactKey) ??
    documents.find((document) => document.type === fallbackType)
  );
}

export function getResultsSummaryCards(args: {
  controls: Control[];
  findings: AuditFinding[];
  now: string;
  questions: Question[];
  requests: Request[];
  documents: AuditDocument[];
}) {
  const passedControls = args.controls.filter((control) => control.status === "COMPLETE").length;
  const failedOrBlockedControls = args.controls.filter((control) => control.status === "BLOCKED").length;
  const activeFindings = args.findings.filter((finding) => finding.status !== "CLOSED").length;
  const openFollowUps =
    args.questions.filter((question) => getQuestionDisplayStatus(question, args.now) !== "RESPONDED").length +
    args.requests.filter((request) => getRequestDisplayStatus(request, args.now) !== "COMPLETED").length;
  const reportArtifactsReady = args.documents.filter(
    (document) =>
      (document.artifactKey === "FINAL_REPORT" || document.artifactKey === "REPORTING_TOLLGATE" || document.type === "REPORT") &&
      document.status === "COMPLETE",
  ).length;

  return [
    { label: "Controls passed", value: String(passedControls), detail: "Testing concluded with a completed control status." },
    { label: "Blocked controls", value: String(failedOrBlockedControls), detail: "Controls still creating pressure in the reporting narrative." },
    { label: "Open findings", value: String(activeFindings), detail: "Findings still being drafted, reviewed, or finalized." },
    { label: "Open follow-ups", value: String(openFollowUps), detail: "Questions and requests that can still affect issuance." },
    { label: "Report artifacts ready", value: `${reportArtifactsReady}/2`, detail: "Final report and reporting tollgate artifact readiness." },
  ];
}

export function getFindingStatusTone(status: AuditFinding["status"]) {
  if (status === "FINALIZED" || status === "CLOSED") {
    return "success";
  }

  if (status === "READY_FOR_REPORT") {
    return "warning";
  }

  return "risk";
}

export function getFindingOwnerLabel(finding: AuditFinding, users: User[]) {
  return users.find((user) => user.id === finding.ownerId)?.name ?? "Unassigned";
}

export function getFindingControlLabel(finding: AuditFinding, controls: Control[]) {
  const control = controls.find((entry) => entry.id === finding.linkedControlId);

  if (!control) {
    return "No linked control";
  }

  return `${control.referenceId ?? control.id} · ${control.name}`;
}

export function getReportReadinessMessage(stages: ReportReviewStage[], unresolvedComments: ReportReviewComment[]) {
  if (!getWorkflowCompletionState(stages)) {
    const activeStage = getActiveReviewStage(stages);
    return activeStage
      ? `Awaiting ${activeStage.reviewerRole.toLowerCase()} review before the artifact can be issued.`
      : "Reporting workflow has not been submitted into review yet.";
  }

  if (unresolvedComments.length > 0) {
    return `${unresolvedComments.length} review comments still need resolution before issuance.`;
  }

  return "Workflow approvals are complete and no unresolved review comments remain.";
}

export function formatFindingDueDate(value?: string) {
  return value ? formatShortDate(value) : "No due date";
}
