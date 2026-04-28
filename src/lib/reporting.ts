import { buildNarrativePreview } from "@/lib/planning-narrative/format";
import { linkedSignalsForDocument } from "@/lib/document-support";
import { getQuestionDisplayStatus, getRequestDisplayStatus } from "@/lib/audit-logic";
import { formatShortDate } from "@/lib/utils";
import type {
  AuditDocument,
  Control,
  Question,
  ReportArtifactKey,
  ReportReviewComment,
  ReportReviewStage,
  Request,
  Role,
  User,
} from "@/types/audit";

export type ReportingResultItem = {
  id: string;
  blockerCount: number;
  blockerTone: "warning" | "risk" | "success";
  displayId: string;
  dueDate?: string;
  isAtRisk: boolean;
  isReportingReady: boolean;
  linkedControlId?: string;
  linkedControlLabel: string;
  ownerId: string;
  ownerName: string;
  reviewStatus: string;
  title: string;
  type: "WORKPAPER" | "EVIDENCE";
  updatedAt?: string;
};

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
  documents: AuditDocument[];
  now: string;
  questions: Question[];
  requests: Request[];
  results: ReportingResultItem[];
  users: User[];
};

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
      comment: "Confirm the overdue fieldwork support is either resolved or clearly disclosed before final issuance.",
      status: "OPEN",
      createdAt: new Date().toISOString(),
    },
  ];
}

export function buildReportingResults(args: {
  controls: Control[];
  documents: AuditDocument[];
  now: string;
  questions: Question[];
  requests: Request[];
  users: User[];
}) {
  return args.documents
    .filter((document): document is AuditDocument & { type: "WORKPAPER" | "EVIDENCE" } => document.type === "WORKPAPER" || document.type === "EVIDENCE")
    .slice()
    .sort((left, right) => {
      const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;

      return leftDue - rightDue || (left.displayId ?? left.id).localeCompare(right.displayId ?? right.id);
    })
    .map((document) => {
      const blockers = linkedSignalsForDocument(document, args.controls, args.questions, args.requests, args.now);
      const blockerTone = blockers.some((blocker) => blocker.tone === "risk")
        ? "risk"
        : blockers.some((blocker) => blocker.tone === "warning")
          ? "warning"
          : "success";
      const reviewStatus = document.reviewStatus ?? "NOT_SUBMITTED";
      const isReportingReady =
        document.type === "WORKPAPER"
          ? reviewStatus === "APPROVED"
          : document.status === "COMPLETE";
      const linkedControl = document.linkedControlId ? args.controls.find((control) => control.id === document.linkedControlId) : null;
      const ownerName = args.users.find((user) => user.id === document.ownerId)?.name ?? document.ownerId;
      const dueDatePassed = document.dueDate ? new Date(document.dueDate).getTime() < new Date(args.now).getTime() : false;

      return {
        id: document.id,
        blockerCount: blockers.filter((blocker) => blocker.tone !== "success").length,
        blockerTone,
        displayId: document.displayId ?? document.id,
        dueDate: document.dueDate,
        isAtRisk: dueDatePassed || blockers.some((blocker) => blocker.tone !== "success"),
        isReportingReady,
        linkedControlId: document.linkedControlId,
        linkedControlLabel: linkedControl ? `${linkedControl.referenceId ?? linkedControl.id} - ${linkedControl.name}` : "No linked control",
        ownerId: document.ownerId,
        ownerName,
        reviewStatus,
        title: document.title,
        type: document.type,
        updatedAt: document.updatedAt,
      } satisfies ReportingResultItem;
    });
}

export function createReportDraftMarkdown(context: ReportingNarrativeContext) {
  const reportingReadyResults = context.results.filter((result) => result.isReportingReady);
  const openResults = context.results.filter((result) => !result.isReportingReady);
  const atRiskResults = context.results.filter((result) => result.isAtRisk);
  const openFollowUps = getOpenFollowUpCount(context.questions, context.requests, context.now);
  const scopeLimitations = openResults.filter((result) => result.blockerCount > 0 || result.type === "WORKPAPER");

  return [
    "# Final Audit Report Draft",
    "",
    "## Executive Summary",
    `${context.auditLabel} has moved into reporting closeout. ${reportingReadyResults.length} of ${context.results.length} fieldwork results are reporting-ready, while ${atRiskResults.length} still require leadership attention before issuance.`,
    "",
    "## Scope, Objectives, and Methodology",
    `The report reflects audit conclusions supported by completed fieldwork workpapers, evidence, linked control testing, and open follow-up analysis across ${context.controls.length} controls.`,
    "",
    "## Overall Conclusion",
    getOverallConclusion(reportingReadyResults.length, context.results.length, atRiskResults.length),
    "",
    "## Results Supporting the Report",
    ...(context.results.length > 0
      ? context.results.map(
          (result) =>
            `- ${result.displayId}: ${result.title} (${result.type.toLowerCase()}, ${result.isReportingReady ? "reporting-ready" : "still open"}, control: ${result.linkedControlLabel})`,
        )
      : ["- No fieldwork results are currently available for reporting."]),
    "",
    "## Items Requiring Management Attention",
    ...(atRiskResults.length > 0
      ? atRiskResults.slice(0, 8).map(
          (result) =>
            `- ${result.displayId}: ${result.title}. Owner: ${result.ownerName}. ${describeResultIssue(result)}`,
        )
      : ["- No unresolved reporting issues remain in the current result set."]),
    "",
    "## Management Response Status",
    openFollowUps > 0
      ? `Management responses or related follow-ups remain in progress for ${openFollowUps} questions and requests. Responses should be confirmed before the report is locked.`
      : "No open question or request follow-ups remain that would hold up management response readiness.",
    "",
    "## Scope Limitations and Exceptions",
    ...(scopeLimitations.length > 0
      ? scopeLimitations.slice(0, 5).map(
          (result) =>
            `- ${result.displayId}: ${result.title} remains ${result.isReportingReady ? "available" : "not yet fully ready"} for reporting use and should be disclosed or resolved before issuance.`,
        )
      : ["- No scope limitations or unresolved support exceptions are currently identified."]),
    "",
    "## Issuance Readiness Summary",
    `Final issuance should proceed only after all required review workflow stages are approved, open follow-ups are resolved or disclosed, and the reporting tollgate decision is recorded as GO.`,
  ].join("\n");
}

export function createReportingTollgateMarkdown(context: ReportingNarrativeContext) {
  const reportingReadyResults = context.results.filter((result) => result.isReportingReady);
  const incompleteResults = context.results.filter((result) => !result.isReportingReady);
  const openFollowUps = getOpenFollowUpCount(context.questions, context.requests, context.now);
  const goDecision = incompleteResults.length === 0 && openFollowUps === 0 ? "GO" : "NO-GO";

  return [
    "# Reporting Tollgate Draft",
    "",
    "## Purpose & Timing",
    `This tollgate sits between fieldwork completion and final report issuance for ${context.auditLabel}. It confirms whether the report package is accurate, supported, and ready to lock.`,
    "",
    "## 1. Completeness of Fieldwork",
    `- Reporting-ready support: ${reportingReadyResults.length} of ${context.results.length} fieldwork results.`,
    `- Open or incomplete support items: ${incompleteResults.length}.`,
    `- Evidence should support every conclusion before report issuance.`,
    ...buildOpenResultBullets(incompleteResults),
    "",
    "## 2. Finding Quality & Accuracy",
    `- Reporting should confirm that all observations are supported by completed workpapers and evidence, and that the 4 Cs are clear in the final narrative where needed.`,
    `- At-risk result items currently identified: ${context.results.filter((result) => result.isAtRisk).length}.`,
    "",
    "## 3. Risk Rating Consistency",
    `- High-risk controls in scope: ${context.controls.filter((control) => control.riskLevel === "HIGH").length}.`,
    `- Reporting reviewers should confirm consistent rating calibration across the final narrative and linked support.`,
    "",
    "## 4. Management Response Readiness",
    `- Open question/request follow-ups that may affect responses: ${openFollowUps}.`,
    openFollowUps > 0
      ? "- Management responses should be confirmed as collected, adequate, or explicitly tracked as open before report lock."
      : "- No open follow-up items remain that would delay management response readiness.",
    "",
    "## 5. Report Tone & Language",
    "- Confirm the executive summary is objective, concise, and focused on the highest-risk conclusions.",
    "- Confirm wording is professional, fact-based, and free from blame-oriented language.",
    "",
    "## 6. Compliance with Audit Standards",
    "- Confirm the final report clearly states scope, objectives, methodology, and any scope limitations.",
    "- Confirm the report aligns to the applicable audit framework before issuance.",
    "",
    "## 7. Stakeholder & Distribution Review",
    "- Confirm the distribution list is appropriate for the report content and any sensitive issues.",
    "- Confirm CAE or delegated leadership approval is captured before issuance.",
    "",
    "## 8. Timeliness",
    `- Results still not reporting-ready: ${incompleteResults.length}.`,
    `- Open follow-up items affecting timing: ${openFollowUps}.`,
    "- If issuance is delayed, document the reason and owner before the tollgate closes.",
    "",
    "## Tollgate Output",
    `- Decision: ${goDecision}`,
    `- Reporting-ready support count: ${reportingReadyResults.length}`,
    `- Open items requiring action: ${incompleteResults.length + openFollowUps}`,
    "",
    "## Open Items, Owners, and Deadlines",
    ...(buildOpenItemAssignments(incompleteResults) || ["- No open reporting support items remain."]),
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
  documents: AuditDocument[];
  now: string;
  questions: Question[];
  requests: Request[];
  results: ReportingResultItem[];
}) {
  const reportingReadyCount = args.results.filter((result) => result.isReportingReady).length;
  const inReviewCount = args.results.filter(
    (result) => result.type === "WORKPAPER" && result.reviewStatus !== "APPROVED" && result.reviewStatus !== "NOT_SUBMITTED",
  ).length;
  const atRiskCount = args.results.filter((result) => result.isAtRisk).length;
  const openFollowUps = getOpenFollowUpCount(args.questions, args.requests, args.now);
  const reportArtifactsReady = args.documents.filter(
    (document) =>
      (document.artifactKey === "FINAL_REPORT" || document.artifactKey === "REPORTING_TOLLGATE" || document.type === "REPORT") &&
      document.status === "COMPLETE",
  ).length;

  return [
    { label: "Reporting-ready results", value: `${reportingReadyCount}/${args.results.length}`, detail: "Fieldwork workpapers and evidence currently ready for reporting use." },
    { label: "Results in review", value: String(inReviewCount), detail: "Workpapers still waiting on review completion before reporting can fully rely on them." },
    { label: "At-risk support items", value: String(atRiskCount), detail: "Results with overdue dates or unresolved linked blockers." },
    { label: "Open follow-ups", value: String(openFollowUps), detail: "Questions and requests that can still affect report issuance." },
    { label: "Report artifacts ready", value: `${reportArtifactsReady}/2`, detail: "Final report and reporting tollgate artifact readiness." },
  ];
}

export function getReportReadinessMessage(stages: ReportReviewStage[], unresolvedComments: ReportReviewComment[]) {
  if (stages.length === 0) {
    return "No reporting review workflow has been loaded for this live audit yet.";
  }

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

function getOpenFollowUpCount(questions: Question[], requests: Request[], now: string) {
  return (
    questions.filter((question) => getQuestionDisplayStatus(question, now) !== "RESPONDED").length +
    requests.filter((request) => getRequestDisplayStatus(request, now) !== "COMPLETED").length
  );
}

function getOverallConclusion(reportingReadyCount: number, totalResults: number, atRiskCount: number) {
  if (totalResults === 0) {
    return "Fieldwork support has not yet been assembled into reporting results, so no conclusion should be issued.";
  }

  if (atRiskCount === 0 && reportingReadyCount === totalResults) {
    return "Fieldwork support is complete and the audit is positioned to finalize the report without material readiness concerns.";
  }

  if (reportingReadyCount === 0) {
    return "The reporting package is not yet supportable because no fieldwork results are currently reporting-ready.";
  }

  return `The audit has sufficient progress to draft conclusions, but ${totalResults - reportingReadyCount} result items still require resolution or disclosure before issuance.`;
}

function describeResultIssue(result: ReportingResultItem) {
  if (result.blockerCount > 0) {
    return `${result.blockerCount} linked blocker(s) remain open.`;
  }

  if (!result.isReportingReady) {
    return `Review status is ${result.reviewStatus.replaceAll("_", " ").toLowerCase()}.`;
  }

  return "Support is available but should still be confirmed in the final report package.";
}

function buildOpenResultBullets(results: ReportingResultItem[]) {
  if (results.length === 0) {
    return ["- All current fieldwork support appears complete for reporting use."];
  }

  return results.slice(0, 6).map(
    (result) =>
      `- ${result.displayId}: ${result.title} (${result.type.toLowerCase()}) remains open with owner ${result.ownerName}.`,
  );
}

function buildOpenItemAssignments(results: ReportingResultItem[]) {
  if (results.length === 0) {
    return [];
  }

  return results.slice(0, 8).map((result) => {
    const dueLabel = result.dueDate ? formatShortDate(result.dueDate) : "No deadline recorded";
    return `- ${result.displayId}: ${result.title}. Owner: ${result.ownerName}. Deadline: ${dueLabel}.`;
  });
}
