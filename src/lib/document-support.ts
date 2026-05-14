import { getQuestionDisplayStatus, getRequestDisplayStatus } from "@/lib/audit-logic";
import { formatReviewWorkflowStageLabel } from "@/lib/audit-settings";
import type { AuditDocument, Control, DocumentReviewStatus, Question, Request, User } from "@/types/audit";

export type LinkedDocumentSignal = {
  id: string;
  title: string;
  detail: string;
  status: string;
  tone: "warning" | "risk" | "success";
};

export function getDocumentOwnerName(ownerId: string, users: User[]) {
  return users.find((user) => user.id === ownerId)?.name ?? ownerId;
}

export function getLinkedControlLabel(document: Pick<AuditDocument, "linkedControlId">, controls: Control[]) {
  if (!document.linkedControlId) {
    return "No linked control";
  }

  const control = controls.find((item) => item.id === document.linkedControlId);

  if (!control) {
    return document.linkedControlId;
  }

  return `${control.referenceId ?? control.id} - ${control.name}`;
}

export function linkedSignalsForDocument(document: AuditDocument, controls: Control[], questions: Question[], requests: Request[], now: string) {
  return getLinkedBlockers(document, controls, questions, requests, now);
}

export function getLinkedBlockers(document: AuditDocument, controls: Control[], questions: Question[], requests: Request[], now: string) {
  const blockers: LinkedDocumentSignal[] = [];

  if (document.linkedControlId) {
    const control = controls.find((entry) => entry.id === document.linkedControlId);
    if (control) {
      blockers.push({
        id: control.referenceId ?? control.id,
        title: control.name,
        detail: control.status === "COMPLETE" ? "Linked control is complete." : "Linked control still has open execution work.",
        status: control.status.replaceAll("_", " "),
        tone: control.status === "COMPLETE" ? "success" : control.status === "BLOCKED" ? "risk" : "warning",
      });
    }
  }

  if (document.linkedQuestionId) {
    const question = questions.find((entry) => entry.id === document.linkedQuestionId);
    if (question) {
      const status = getQuestionDisplayStatus(question, now);
      blockers.push({
        id: question.displayId ?? question.id,
        title: question.questionText,
        detail: status === "RESPONDED" ? "Question response is on file." : "Question response is still pending.",
        status,
        tone: status === "RESPONDED" ? "success" : status === "OVERDUE" ? "risk" : "warning",
      });
    }
  }

  if (document.linkedRequestId) {
    const request = requests.find((entry) => entry.id === document.linkedRequestId);
    if (request) {
      const status = getRequestDisplayStatus(request, now);
      blockers.push({
        id: request.displayId ?? request.id,
        title: request.description,
        detail: status === "COMPLETED" ? "Request support is complete." : "Request support is still open.",
        status,
        tone: status === "COMPLETED" ? "success" : status === "OVERDUE" ? "risk" : "warning",
      });
    }
  }

  return blockers;
}

export function isDocumentAtRisk(
  document: AuditDocument,
  linkedBlockers: Array<{ status: string; tone: "warning" | "risk" | "success" }>,
  now: string,
) {
  const dueDatePassed = document.dueDate ? new Date(document.dueDate).getTime() < new Date(now).getTime() : false;
  const unresolvedBlocker = linkedBlockers.some((blocker) => blocker.tone !== "success");
  return dueDatePassed || unresolvedBlocker;
}

export function formatReviewStatus(status: DocumentReviewStatus) {
  return formatReviewWorkflowStageLabel(status);
}

export function getReviewTone(status: DocumentReviewStatus): "neutral" | "warning" | "risk" | "success" {
  if (status === "APPROVED") {
    return "success";
  }

  if (status === "NOT_SUBMITTED") {
    return "risk";
  }

  return "warning";
}
