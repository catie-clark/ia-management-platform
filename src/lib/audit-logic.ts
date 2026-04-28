import {
  budgetByPhase,
  controls,
  documents,
  milestones,
  mockNow,
  questions,
  requests,
  users,
} from "@/lib/data/mock-data";
import { formatHours } from "@/lib/utils";
import { normalizeAuditPhase } from "@/lib/audit-phase";
import type {
  AuditDocument,
  AuditPhase,
  BudgetByPhase,
  Control,
  KPIProps,
  PhaseSpotlight,
  Question,
  Request,
  RiskRow,
  TimelineItem,
  User,
} from "@/types/audit";

const REMINDER_WINDOW_HOURS = 48;
const defaultContext = {
  budgetByPhase,
  controls,
  documents,
  milestones,
  now: mockNow,
  questions,
  requests,
  users,
};

type AuditLogicContext = {
  budgetByPhase: BudgetByPhase[];
  controls: Control[];
  documents: AuditDocument[];
  milestones: TimelineItem[];
  now: string;
  questions: Question[];
  requests: Request[];
  users: User[];
};

const planningDocumentTypes = new Set<AuditDocument["type"]>(["PLANNING_NARRATIVE", "PLANNING_TOLLGATE"]);
const reportingDocumentTypes = new Set<AuditDocument["type"]>(["REPORT", "TOLLGATE"]);
const requiredPlanningDocumentTypes: AuditDocument["type"][] = ["PLANNING_NARRATIVE", "PLANNING_TOLLGATE"];

export function hourDiff(target: string, source: string) {
  return (new Date(target).getTime() - new Date(source).getTime()) / (1000 * 60 * 60);
}

export function shouldShowReminder(item: Control | Question | Request, now = defaultContext.now): boolean {
  if ("plannedHours" in item) {
    if (!item.dueDate) {
      return false;
    }

    const hoursToDue = hourDiff(item.dueDate, now);
    return hoursToDue <= REMINDER_WINDOW_HOURS && hoursToDue >= 0;
  }

  if ("dateRequested" in item) {
    const hoursToDue = hourDiff(item.dueDate, now);
    return item.status !== "COMPLETED" && hoursToDue <= REMINDER_WINDOW_HOURS && hoursToDue >= 0;
  }

  const ageInHours = hourDiff(now, item.dateSent);
  return item.status === "OPEN" && ageInHours > REMINDER_WINDOW_HOURS;
}

export function getNow(now = defaultContext.now) {
  return new Date(now);
}

export function getUserName(id: string, userPool = defaultContext.users) {
  return userPool.find((user) => user.id === id)?.name ?? id;
}

export function getControlOwner(control: Control, userPool = defaultContext.users) {
  return getUserName(control.ownerId, userPool);
}

export function getControlVariance(control: Control) {
  return control.actualHours - control.plannedHours;
}

export function isDocumentOverdue(document: AuditDocument, now = defaultContext.now) {
  return Boolean(document.dueDate) && new Date(document.dueDate!).getTime() < getNow(now).getTime() && document.status !== "COMPLETE";
}

export function hasOverdueLinkedItems(control: Control, context: AuditLogicContext = defaultContext) {
  const hasOverdueQuestions = getLinkedQuestions(control.id, context.questions).some((question) => isQuestionOverdue(question, context.now));
  const hasOverdueRequests = getLinkedRequests(control.id, context.requests).some((request) => isRequestOverdue(request, context.now));
  const hasOverdueDocuments = getLinkedDocuments(control.id, context.documents).some((document) => isDocumentOverdue(document, context.now));

  return hasOverdueQuestions || hasOverdueRequests || hasOverdueDocuments;
}

export function getDerivedControlStatus(control: Control, context: AuditLogicContext = defaultContext): Control["status"] {
  if (control.status === "COMPLETE") {
    return "COMPLETE";
  }

  if (!isControlOverdue(control, context.now)) {
    return control.status;
  }

  return hasOverdueLinkedItems(control, context) ? "BLOCKED" : "IN_PROGRESS";
}

export function getControlRiskLevel(control: Control, context: AuditLogicContext = defaultContext): Control["riskLevel"] {
  let score = 0;

  if (isControlOverdue(control, context.now)) {
    score += 3;
  }

  if (getDerivedControlStatus(control, context) === "BLOCKED") {
    score += 2;
  }

  const variance = getControlVariance(control);
  if (variance > 0) {
    score += variance >= 3 ? 2 : 1;
  }

  const overdueQuestions = getLinkedQuestions(control.id, context.questions).filter((question) => isQuestionOverdue(question, context.now)).length;
  const openQuestions = getLinkedQuestions(control.id, context.questions).filter((question) => getQuestionDisplayStatus(question, context.now) === "OPEN").length;
  const overdueRequests = getLinkedRequests(control.id, context.requests).filter((request) => isRequestOverdue(request, context.now)).length;
  const incompleteDocuments = getLinkedDocuments(control.id, context.documents).filter((document) => document.reviewStatus !== "APPROVED").length;

  score += Math.min(2, overdueQuestions * 2);
  score += openQuestions > 0 ? 1 : 0;
  score += Math.min(2, overdueRequests);
  score += incompleteDocuments > 0 ? 1 : 0;

  if (["Retail Banking", "Treasury Operations", "Compliance Operations", "BSA Operations"].includes(control.businessUnit)) {
    score += 1;
  }

  if (score >= 5) {
    return "HIGH";
  }

  if (score >= 3) {
    return "MEDIUM";
  }

  return "LOW";
}

export function isControlOverdue(control: Control, now = defaultContext.now) {
  if (!control.dueDate) {
    return false;
  }

  return new Date(control.dueDate).getTime() < getNow(now).getTime() && control.status !== "COMPLETE";
}

export function getQuestionAgeHours(question: Question, now = defaultContext.now) {
  return Math.max(0, hourDiff(now, question.dateSent));
}

export function isRequestOverdue(request: Request, now = defaultContext.now) {
  return new Date(request.dueDate).getTime() < getNow(now).getTime() && request.status !== "COMPLETED";
}

export function isQuestionOverdue(question: Question, now = defaultContext.now) {
  return new Date(question.dueDate).getTime() < getNow(now).getTime() && question.status !== "RESPONDED";
}

export function getQuestionDisplayStatus(question: Question, now = defaultContext.now): Question["status"] {
  return isQuestionOverdue(question, now) ? "OVERDUE" : question.status;
}

export function getRequestDisplayStatus(request: Request, now = defaultContext.now) {
  return isRequestOverdue(request, now) ? "OVERDUE" : request.status;
}

export function getQuestionCurrentDelayHours(question: Question, now = defaultContext.now) {
  if (question.status !== "OPEN" && question.status !== "OVERDUE") {
    return 0;
  }

  return Math.max(0, hourDiff(now, question.dueDate));
}

export function getQuestionRealizedDelayHours(question: Question) {
  if (!question.responseDate) {
    return 0;
  }

  return Math.max(0, hourDiff(question.responseDate, question.dueDate));
}

export function getRequestCurrentDelayHours(request: Request, now = defaultContext.now) {
  if (request.status === "COMPLETED") {
    return 0;
  }

  return Math.max(0, hourDiff(now, request.dueDate));
}

export function getRequestRealizedDelayHours(request: Request) {
  const resolvedAt = request.completedAt ?? request.receivedDate;

  if (!resolvedAt) {
    return 0;
  }

  return Math.max(0, hourDiff(resolvedAt, request.dueDate));
}

export function getQuestionChainDelayHours(
  question: Question,
  questionPool: Question[],
  requestPool: Request[],
  now = defaultContext.now,
) {
  return getChainDelayHours({ question, questionPool, requestPool, now, visitedKeys: new Set<string>() });
}

export function getRequestChainDelayHours(
  request: Request,
  questionPool: Question[],
  requestPool: Request[],
  now = defaultContext.now,
) {
  return getChainDelayHours({ request, questionPool, requestPool, now, visitedKeys: new Set<string>() });
}

export function getQuestionFollowUps(question: Question, questionPool: Question[], requestPool: Request[]) {
  return {
    questions: questionPool.filter((entry) => entry.parentQuestionId === question.id),
    requests: requestPool.filter((entry) => entry.parentQuestionId === question.id),
  };
}

export function getRequestFollowUps(request: Request, questionPool: Question[], requestPool: Request[]) {
  return {
    questions: questionPool.filter((entry) => entry.parentRequestId === request.id),
    requests: requestPool.filter((entry) => entry.parentRequestId === request.id),
  };
}

export function getLinkedQuestions(controlId: string, questionPool = defaultContext.questions) {
  return questionPool.filter((question) => question.controlId === controlId);
}

export function getLinkedRequests(controlId: string, requestPool = defaultContext.requests) {
  return requestPool.filter((request) => request.controlId === controlId);
}

export function getLinkedDocuments(controlId: string, documentPool = defaultContext.documents) {
  return documentPool.filter((document) => document.linkedControlId === controlId);
}

export function getQuestionRelatedDocuments(questionId: string, documentPool = defaultContext.documents) {
  return documentPool.filter((document) => document.linkedQuestionId === questionId);
}

export function getRequestRelatedDocuments(requestId: string, documentPool = defaultContext.documents) {
  return documentPool.filter((document) => document.linkedRequestId === requestId);
}

export function getDocumentStatusSummary(items: AuditDocument[]) {
  return {
    complete: items.filter((item) => item.status === "COMPLETE").length,
    inProgress: items.filter((item) => item.status === "IN_PROGRESS").length,
    notStarted: items.filter((item) => item.status === "NOT_STARTED").length,
  };
}

export function deriveAuditPhaseFromStatus(status?: string): AuditPhase {
  return normalizeAuditPhaseFromAudit({ status });
}

export function normalizeAuditPhaseFromAudit(audit: { active_phase?: string | null; status?: string | null }): AuditPhase {
  if (audit.active_phase) {
    return normalizeAuditPhase(audit.active_phase);
  }

  const normalized = audit.status?.trim().toLowerCase() ?? "";

  if (normalized.includes("plan") || normalized.includes("scope") || normalized.includes("kickoff")) {
    return "Planning";
  }

  if (normalized.includes("report") || normalized.includes("final")) {
    return "Reporting";
  }

  return "Fieldwork";
}

export function getDashboardKpis(phase: AuditPhase, context: AuditLogicContext = defaultContext): KPIProps[] {
  if (phase === "Planning") {
    const ownerAssignedCount = context.controls.filter((control) => Boolean(control.ownerId)).length;
    const dueDatesAssignedCount = context.controls.filter((control) => Boolean(control.assignedDueDate)).length;
    const configuredPhaseBudgets = context.budgetByPhase.filter((phaseBudget) => phaseBudget.isSet).length;
    const missingPhaseBudgets = context.budgetByPhase.length - configuredPhaseBudgets;
    const planningArtifactsReady = requiredPlanningDocumentTypes.filter((type) =>
      context.documents.some((document) => document.type === type && document.status === "COMPLETE"),
    ).length;
    const totalControls = context.controls.length;
    const totalPlanningArtifacts = requiredPlanningDocumentTypes.length;

    return [
      {
        title: "Owners assigned",
        value: `${getPercent(ownerAssignedCount, totalControls)}%`,
        status: ownerAssignedCount === totalControls ? "normal" : ownerAssignedCount >= Math.ceil(totalControls / 2) ? "warning" : "risk",
        subtitle: `${ownerAssignedCount} of ${totalControls} controls have an assigned audit owner`,
        delta: ownerAssignedCount === totalControls ? "Owner assignment is complete" : `${totalControls - ownerAssignedCount} controls still need assignment`,
      },
      {
        title: "Phase budgets pending",
        value: missingPhaseBudgets,
        status: missingPhaseBudgets > 0 ? "risk" : "normal",
        subtitle: `${configuredPhaseBudgets} of ${context.budgetByPhase.length} phase budgets are configured`,
        delta:
          missingPhaseBudgets > 0
            ? "Set planning, fieldwork, and reporting budgets before kickoff"
            : "All audit phase budgets are configured",
      },
      {
        title: "Target dates set",
        value: `${getPercent(dueDatesAssignedCount, totalControls)}%`,
        status: dueDatesAssignedCount === totalControls ? "normal" : "warning",
        subtitle: `${dueDatesAssignedCount} of ${totalControls} controls have a committed target date`,
        delta: dueDatesAssignedCount === totalControls ? "Timeline setup is complete" : `${totalControls - dueDatesAssignedCount} controls are still missing target dates`,
      },
      {
        title: "Planning artifacts ready",
        value: `${planningArtifactsReady}/${totalPlanningArtifacts}`,
        status: planningArtifactsReady === totalPlanningArtifacts ? "normal" : "risk",
        subtitle: "Planning narrative and tollgate deck tracked together",
        delta:
          planningArtifactsReady === totalPlanningArtifacts
            ? "Planning package is ready for sign-off"
            : `${totalPlanningArtifacts - planningArtifactsReady} planning artifacts still open`,
      },
    ];
  }

  if (phase === "Reporting") {
    const totalControls = context.controls.length;
    const completedControls = context.controls.filter((control) => control.status === "COMPLETE").length;
    const reportArtifacts = context.documents.filter((document) => reportingDocumentTypes.has(document.type));
    const reportArtifactsReady = reportArtifacts.filter((document) => document.status === "COMPLETE").length;
    const unresolvedQuestions = context.questions.filter((question) => question.status !== "RESPONDED").length;
    const unresolvedRequests = context.requests.filter((request) => request.status !== "COMPLETED").length;
    const actualHours = context.budgetByPhase.reduce((sum, item) => sum + item.actualHours, 0);
    const plannedHours = context.budgetByPhase.reduce((sum, item) => sum + item.plannedHours, 0);

    return [
      {
        title: "Controls finalized",
        value: `${getPercent(completedControls, totalControls)}%`,
        status: completedControls === totalControls ? "normal" : "warning",
        subtitle: `${completedControls} of ${totalControls} controls are complete`,
        delta: completedControls === totalControls ? "Execution is closed" : `${totalControls - completedControls} controls still need closure`,
      },
      {
        title: "Report package ready",
        value: `${reportArtifactsReady}/${reportArtifacts.length}`,
        status: reportArtifactsReady === reportArtifacts.length ? "normal" : "warning",
        subtitle: "Final report and tollgate artifacts",
        delta:
          reportArtifactsReady === reportArtifacts.length
            ? "Reporting artifacts are ready to issue"
            : `${reportArtifacts.length - reportArtifactsReady} report artifacts still open`,
      },
      {
        title: "Open follow-ups",
        value: unresolvedQuestions + unresolvedRequests,
        status: unresolvedQuestions + unresolvedRequests > 0 ? "risk" : "normal",
        subtitle: `${unresolvedQuestions} questions and ${unresolvedRequests} requests remain open`,
        delta: unresolvedQuestions + unresolvedRequests > 0 ? "Clear open items before issue drafting" : "No open follow-ups remain",
      },
      {
        title: "Hours consumed",
        value: formatHours(actualHours),
        status: actualHours > plannedHours ? "risk" : "normal",
        subtitle: `${formatHours(plannedHours)} planned across phases`,
        delta: actualHours > plannedHours ? `+${formatHours(actualHours - plannedHours)} over plan` : "Tracking inside budget",
      },
    ];
  }

  const totalControls = context.controls.length;
  const completedControls = context.controls.filter((control) => control.status === "COMPLETE").length;
  const openQuestions = context.questions.filter((question) => question.status !== "RESPONDED").length;
  const actualHours = context.budgetByPhase.reduce((sum, item) => sum + item.actualHours, 0);
  const plannedHours = context.budgetByPhase.reduce((sum, item) => sum + item.plannedHours, 0);
  const missingDocuments = context.documents.filter((document) => document.status === "NOT_STARTED").length;
  const controlCompletion = totalControls === 0 ? 0 : Math.round((completedControls / totalControls) * 100);
  const followUps = context.questions.filter((question) => shouldShowReminder(question, context.now)).length;

  return [
    {
      title: "Control completion",
      value: `${controlCompletion}%`,
      status: totalControls > 0 && completedControls === totalControls ? "normal" : "warning",
      subtitle: `${completedControls} of ${totalControls} controls complete`,
      delta: totalControls === 0 ? "Awaiting imported control population" : "Fieldwork pacing behind plan",
    },
    {
      title: "Hours consumed",
      value: formatHours(actualHours),
      status: actualHours > plannedHours ? "risk" : "normal",
      subtitle: `${formatHours(plannedHours)} planned across phases`,
      delta: actualHours > plannedHours ? `+${formatHours(actualHours - plannedHours)} over plan` : "Tracking inside budget",
    },
    {
      title: "Open questions",
      value: openQuestions,
      status: openQuestions > 1 ? "warning" : "normal",
      subtitle: `${followUps} require follow-up`,
      delta: "48h SLA monitored inline",
    },
    {
      title: "Missing documents",
      value: missingDocuments,
      status: missingDocuments > 0 ? "risk" : "normal",
      subtitle: "Planning and reporting artifacts tracked",
      delta: "Draft gaps visible before tollgates",
    },
  ];
}

export function getRiskRows(phase: AuditPhase, context: AuditLogicContext = defaultContext): RiskRow[] {
  if (phase === "Planning") {
    const planningControlRows: RiskRow[] = context.controls.reduce<RiskRow[]>((rows, control) => {
        const gaps = getPlanningControlGaps(control);

        if (gaps.length === 0) {
          return rows;
        }

        rows.push({
          id: control.id,
          area: "Control" as const,
          title: control.name,
          owner: control.businessUnit,
          status: summarizePlanningGaps(gaps),
          trigger: `Still missing ${gaps.join(", ")}`,
          dueDate: control.assignedDueDate ?? control.dueDate,
          severity: gaps.length >= 2 ? "risk" as const : "warning" as const,
        });

        return rows;
      }, []);

    const planningDraftDefinitions: Array<{
      fallbackId: string;
      fallbackTitle: string;
      trigger: string;
      type: AuditDocument["type"];
    }> = [
      {
        fallbackId: "planning-narrative-draft",
        fallbackTitle: "Planning Narrative Draft",
        trigger: "Planning narrative draft is not ready for tollgate",
        type: "PLANNING_NARRATIVE",
      },
      {
        fallbackId: "planning-tollgate-draft",
        fallbackTitle: "Planning Tollgate Draft",
        trigger: "Planning tollgate draft is not ready for tollgate",
        type: "PLANNING_TOLLGATE",
      },
    ];

    const planningDocumentRows: RiskRow[] = planningDraftDefinitions.flatMap((definition) => {
      const matchingDocuments = context.documents.filter(
        (document) => document.type === definition.type && document.status !== "COMPLETE",
      );

      if (matchingDocuments.length > 0) {
        return matchingDocuments.map((document) => ({
          id: document.id,
          area: "Document" as const,
          title: document.title || definition.fallbackTitle,
          owner: getUserName(document.ownerId, context.users),
          status: document.status.replaceAll("_", " "),
          trigger: definition.trigger,
          dueDate: document.dueDate,
          severity: document.status === "NOT_STARTED" ? "risk" as const : "warning" as const,
        }));
      }

      return [
        {
          id: definition.fallbackId,
          area: "Document" as const,
          title: definition.fallbackTitle,
          owner: "Audit team",
          status: "NOT STARTED",
          trigger: definition.trigger,
          dueDate: undefined,
          severity: "risk" as const,
        },
      ];
    });

    return [...planningControlRows, ...planningDocumentRows].slice(0, 13);
  }

  if (phase === "Reporting") {
    const incompleteControls: RiskRow[] = context.controls
      .filter((control) => control.status !== "COMPLETE")
      .map((control) => ({
        id: control.id,
        area: "Control" as const,
        title: control.name,
        owner: getUserName(control.ownerId, context.users),
        status: control.status.replaceAll("_", " "),
        trigger: "Control testing not finalized",
        dueDate: control.dueDate,
        severity: control.status === "BLOCKED" ? "risk" as const : "warning" as const,
      }));

    const reportingDocumentRows: RiskRow[] = context.documents
      .filter((document) => reportingDocumentTypes.has(document.type) && document.status !== "COMPLETE")
      .map((document) => ({
        id: document.id,
        area: "Document" as const,
        title: document.title,
        owner: getUserName(document.ownerId, context.users),
        status: document.status.replaceAll("_", " "),
        trigger: "Reporting artifact still open",
        dueDate: document.dueDate,
        severity: document.status === "NOT_STARTED" ? "risk" as const : "warning" as const,
      }));

    return [...reportingDocumentRows, ...incompleteControls].slice(0, 13);
  }

  const controlRows: RiskRow[] = context.controls
    .filter((control) => {
      const hoursToDue = control.dueDate ? hourDiff(control.dueDate, context.now) : Number.POSITIVE_INFINITY;
      return hoursToDue <= 48 || control.actualHours > control.plannedHours;
    })
    .map((control) => ({
      id: control.id,
      area: "Control" as const,
      title: control.name,
      owner: getUserName(control.ownerId, context.users),
      status: getDerivedControlStatus(control, context).replaceAll("_", " "),
      trigger: control.actualHours > control.plannedHours ? "Hours over budget" : "Due inside 48 hours",
      dueDate: control.dueDate,
      severity: control.actualHours > control.plannedHours ? "risk" as const : "warning" as const,
    }));

  const questionRows: RiskRow[] = context.questions
    .filter((question) => shouldShowReminder(question, context.now) || isQuestionOverdue(question, context.now))
    .map((question) => ({
      id: question.id,
      area: "Question" as const,
      title: question.questionText,
      owner: question.assignedTo,
      status: getQuestionDisplayStatus(question, context.now),
      trigger: isQuestionOverdue(question, context.now) ? "Response overdue" : "Awaiting response > 48h",
      dueDate: question.dueDate,
      severity: "risk" as const,
    }));

  const requestRows: RiskRow[] = context.requests
    .filter((request) => new Date(request.dueDate).getTime() < new Date(context.now).getTime() && request.status !== "COMPLETED")
    .map((request) => ({
      id: request.id,
      area: "Request" as const,
      title: request.description,
      owner: request.assignedTo,
      status: request.status.replaceAll("_", " "),
      trigger: "Document request overdue",
      dueDate: request.dueDate,
      severity: "warning" as const,
    }));

  const documentRows: RiskRow[] = context.documents
    .filter((document) => document.status === "NOT_STARTED")
    .map((document) => ({
      id: document.id,
      area: "Document" as const,
      title: document.title,
      owner: getUserName(document.ownerId, context.users),
      status: document.status.replaceAll("_", " "),
      trigger: "Required artifact not started",
      dueDate: document.dueDate,
      severity: "risk" as const,
    }));

  return [...controlRows, ...questionRows, ...requestRows, ...documentRows].slice(0, 13);
}

export function getExecutiveNarrative(phase: AuditPhase, context: AuditLogicContext = defaultContext) {
  const riskRows = getRiskRows(phase, context);
  const topTrigger = riskRows[0]?.trigger?.toLowerCase() ?? "no active blockers";

  if (phase === "Planning") {
    return `Planning is still being assembled, and leadership attention should stay on setup work rather than execution metrics. The most immediate pressure is ${topTrigger}, so the next decisions should lock control ownership, budgeted hours, and the planning package before the team moves into fieldwork.`;
  }

  if (phase === "Reporting") {
    return `The audit is in reporting posture, so the dashboard is prioritizing closure rather than test execution. The main pressure point is ${topTrigger}, and leadership should focus on clearing remaining open controls, finalizing report artifacts, and removing follow-up items that could delay issuance.`;
  }

  return `Midwest Financial Corp remains in active fieldwork with leadership focus centered on execution pressure and blocker removal. The audit is showing early pressure from ${topTrigger}, and leadership should focus on overdue responses, over-budget testing, and incomplete deliverables before the next phase gate.`;
}

export function getPhaseSpotlight(phase: AuditPhase, context: AuditLogicContext = defaultContext): PhaseSpotlight {
  if (phase === "Planning") {
    const controlsAwaitingOwner = context.controls.filter((control) => !control.ownerId).length;
    const controlsAwaitingBudget = context.controls.filter((control) => control.assignedPlannedHours === undefined).length;
    const controlsAwaitingTimeline = context.controls.filter((control) => !control.assignedDueDate).length;
    const planningBudgetHoursPending = context.controls
      .filter((control) => control.assignedPlannedHours === undefined)
      .reduce((sum, control) => sum + (control.importedPlannedHours ?? control.plannedHours), 0);
    const planningArtifactsPending = context.documents.filter(
      (document) => planningDocumentTypes.has(document.type) && document.status !== "COMPLETE",
    ).length;

    return {
      eyebrow: "Planning readiness",
      title: "Setup work leadership should clear before fieldwork",
      description: "This phase view emphasizes decisions and setup gaps that determine whether the team can start testing cleanly.",
      cards: [
        {
          title: "Owner assignment",
          value: controlsAwaitingOwner,
          status: controlsAwaitingOwner > 2 ? "risk" : controlsAwaitingOwner > 0 ? "warning" : "normal",
          detail:
            controlsAwaitingOwner > 0
              ? `${controlsAwaitingOwner} controls still need an assigned audit owner`
              : "All controls have an assigned audit owner",
        },
        {
          title: "Budget sign-off",
          value: controlsAwaitingBudget,
          status: controlsAwaitingBudget > 0 ? "warning" : "normal",
          detail:
            controlsAwaitingBudget > 0
              ? `${formatHours(planningBudgetHoursPending)} still tied to source estimates rather than signed-off budgets`
              : "Every control has a committed hour budget",
        },
        {
          title: "Target dates",
          value: controlsAwaitingTimeline,
          status: controlsAwaitingTimeline > 0 ? "warning" : "normal",
          detail:
            controlsAwaitingTimeline > 0
              ? `${controlsAwaitingTimeline} controls still need a committed testing date`
              : "Timeline setup is complete across the control set",
        },
        {
          title: "Planning package",
          value: planningArtifactsPending,
          status: planningArtifactsPending > 0 ? "risk" : "normal",
          detail:
            planningArtifactsPending > 0
              ? `${planningArtifactsPending} planning artifacts are still open before tollgate`
              : "Planning narrative and tollgate deck are ready",
        },
      ],
    };
  }

  if (phase === "Reporting") {
    const incompleteControls = context.controls.filter((control) => control.status !== "COMPLETE").length;
    const openReportArtifacts = context.documents.filter(
      (document) => reportingDocumentTypes.has(document.type) && document.status !== "COMPLETE",
    ).length;
    const openFollowUps =
      context.questions.filter((question) => question.status !== "RESPONDED").length +
      context.requests.filter((request) => request.status !== "COMPLETED").length;
    const hoursVariance =
      context.budgetByPhase.reduce((sum, item) => sum + item.actualHours, 0) -
      context.budgetByPhase.reduce((sum, item) => sum + item.plannedHours, 0);

    return {
      eyebrow: "Reporting closeout",
      title: "Items that still affect report issuance",
      description: "Once the audit reaches reporting, the dashboard shifts from throughput to closure readiness and outstanding dependencies.",
      cards: [
        {
          title: "Controls still open",
          value: incompleteControls,
          status: incompleteControls > 0 ? "warning" : "normal",
          detail: incompleteControls > 0 ? "Finalize testing before issue themes are locked" : "All controls are finalized",
        },
        {
          title: "Report artifacts open",
          value: openReportArtifacts,
          status: openReportArtifacts > 0 ? "risk" : "normal",
          detail: openReportArtifacts > 0 ? "Report or tollgate documents are still incomplete" : "Report package is assembled",
        },
        {
          title: "Open follow-ups",
          value: openFollowUps,
          status: openFollowUps > 0 ? "warning" : "normal",
          detail: openFollowUps > 0 ? "Outstanding requests can still delay reporting" : "No follow-up items remain",
        },
        {
          title: "Budget variance",
          value: hoursVariance === 0 ? "0h" : `${hoursVariance > 0 ? "+" : "-"}${formatHours(Math.abs(hoursVariance))}`,
          status: hoursVariance > 0 ? "risk" : "normal",
          detail: hoursVariance > 0 ? "The audit is over the original plan" : "Hours remain inside the planned envelope",
        },
      ],
    };
  }

  const blockedControls = context.controls.filter((control) => getDerivedControlStatus(control, context) === "BLOCKED").length;
  const overdueFollowUps =
    context.questions.filter((question) => isQuestionOverdue(question, context.now)).length +
    context.requests.filter((request) => isRequestOverdue(request, context.now)).length;
  const controlsDueSoon = context.controls.filter((control) => {
    const hoursToDue = control.dueDate ? hourDiff(control.dueDate, context.now) : Number.POSITIVE_INFINITY;
    return hoursToDue <= 48 && hoursToDue >= 0;
  }).length;
  const fieldworkBudget = context.budgetByPhase.find((phaseBudget) => phaseBudget.phase === "Fieldwork");
  const fieldworkVariance = (fieldworkBudget?.actualHours ?? 0) - (fieldworkBudget?.plannedHours ?? 0);

  return {
    eyebrow: "Fieldwork pressure",
    title: "Execution signals leadership should intervene on",
    description: "This phase view keeps the attention on testing blockers, open follow-ups, and budget pressure that can move the phase gate.",
    cards: [
      {
        title: "Blocked controls",
        value: blockedControls,
        status: blockedControls > 0 ? "risk" : "normal",
        detail: blockedControls > 0 ? "These controls have overdue linked items or late execution pressure" : "No controls are currently blocked",
      },
      {
        title: "Overdue follow-ups",
        value: overdueFollowUps,
        status: overdueFollowUps > 0 ? "risk" : "normal",
        detail: overdueFollowUps > 0 ? "Questions and requests are now late against the working SLA" : "Follow-up items are current",
      },
      {
        title: "Due inside 48h",
        value: controlsDueSoon,
        status: controlsDueSoon > 0 ? "warning" : "normal",
        detail: controlsDueSoon > 0 ? "Controls are approaching deadline and need active monitoring" : "No near-term control deadlines",
      },
      {
        title: "Fieldwork variance",
        value: fieldworkVariance === 0 ? "0h" : `${fieldworkVariance > 0 ? "+" : "-"}${formatHours(Math.abs(fieldworkVariance))}`,
        status: fieldworkVariance > 0 ? "risk" : "normal",
        detail: fieldworkVariance > 0 ? "Fieldwork is burning faster than planned" : "Fieldwork is pacing to plan",
      },
    ],
  };
}

function getPercent(value: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function getPlanningControlGaps(control: Control) {
  const gaps: string[] = [];

  if (!control.assignedOwnerId) {
    gaps.push("owner");
  }

  if (control.assignedPlannedHours === undefined) {
    gaps.push("hours");
  }

  if (!control.assignedDueDate) {
    gaps.push("due date");
  }

  return gaps;
}

function summarizePlanningGaps(gaps: string[]) {
  if (gaps.length >= 3) {
    return "Setup pending";
  }

  if (gaps.length === 2) {
    return `${capitalize(gaps[0])} + ${gaps[1]} pending`;
  }

  return `${capitalize(gaps[0])} pending`;
}

function getChainDelayHours({
  question,
  request,
  questionPool,
  requestPool,
  now,
  visitedKeys,
}: {
  question?: Question;
  request?: Request;
  questionPool: Question[];
  requestPool: Request[];
  now: string;
  visitedKeys: Set<string>;
}): number {
  const nodeKey = question ? `question:${question.id}` : request ? `request:${request.id}` : null;

  if (!nodeKey || visitedKeys.has(nodeKey)) {
    return 0;
  }

  visitedKeys.add(nodeKey);

  const ownDelay = question
    ? Math.max(getQuestionCurrentDelayHours(question, now), getQuestionRealizedDelayHours(question))
    : request
      ? Math.max(getRequestCurrentDelayHours(request, now), getRequestRealizedDelayHours(request))
      : 0;

  const followUps = question
    ? getQuestionFollowUps(question, questionPool, requestPool)
    : request
      ? getRequestFollowUps(request, questionPool, requestPool)
      : { questions: [], requests: [] };

  const questionDelay: number = followUps.questions.reduce(
    (total, followUp) =>
      total + getChainDelayHours({ question: followUp, questionPool, requestPool, now, visitedKeys }),
    0,
  );
  const requestDelay: number = followUps.requests.reduce(
    (total, followUp) =>
      total + getChainDelayHours({ request: followUp, questionPool, requestPool, now, visitedKeys }),
    0,
  );

  return ownDelay + questionDelay + requestDelay;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
