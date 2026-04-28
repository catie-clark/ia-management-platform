import type { AuditDocument, AuditPhase, Control, ControlScopeStatus, Question, Request, User } from "@/types/audit";

export type ControlAudienceFilter = "ASSIGNED" | "ALL";
export type ScopeFilter = "IN_SCOPE" | "ALL";

export function canUserSeeAllControls(user: Pick<User, "role">) {
  return user.role === "AIC" || user.role === "MANAGER" || user.role === "DIRECTOR";
}

export function getDefaultControlAudienceFilter(user: Pick<User, "role">): ControlAudienceFilter {
  return canUserSeeAllControls(user) ? "ALL" : "ASSIGNED";
}

export function getDefaultScopeFilter(currentPhase: AuditPhase): ScopeFilter {
  return currentPhase === "Planning" ? "ALL" : "IN_SCOPE";
}

export function isControlInScope(control: Pick<Control, "scopeStatus">) {
  return control.scopeStatus !== "OUT_OF_SCOPE";
}

export function filterControlsForUser(
  controls: Control[],
  user: Pick<User, "id" | "role">,
  audienceFilter: ControlAudienceFilter,
  scopeFilter: ScopeFilter,
) {
  return controls.filter((control) => {
    const matchesAudience =
      audienceFilter === "ALL" || canUserSeeAllControls(user) || control.ownerId === user.id || control.assignedOwnerId === user.id;
    const matchesScope = scopeFilter === "ALL" || isControlInScope(control);

    return matchesAudience && matchesScope;
  });
}

export function filterQuestionsForControls(
  questions: Question[],
  visibleControls: Control[],
  user: Pick<User, "name" | "role">,
  audienceFilter: ControlAudienceFilter,
) {
  if (audienceFilter === "ALL" || canUserSeeAllControls(user)) {
    return questions;
  }

  const visibleControlIds = new Set(visibleControls.map((control) => control.id));
  return questions.filter((question) => visibleControlIds.has(question.controlId) || question.askedBy === user.name || question.assignedTo === user.name);
}

export function filterRequestsForControls(
  requests: Request[],
  visibleControls: Control[],
  user: Pick<User, "name" | "role">,
  audienceFilter: ControlAudienceFilter,
) {
  if (audienceFilter === "ALL" || canUserSeeAllControls(user)) {
    return requests;
  }

  const visibleControlIds = new Set(visibleControls.map((control) => control.id));
  return requests.filter((request) => (request.controlId ? visibleControlIds.has(request.controlId) : false) || request.assignedTo === user.name);
}

export function filterDocumentsForControls(
  documents: AuditDocument[],
  visibleControls: Control[],
  user: Pick<User, "id" | "role">,
  audienceFilter: ControlAudienceFilter,
) {
  if (audienceFilter === "ALL" || canUserSeeAllControls(user)) {
    return documents;
  }

  const visibleControlIds = new Set(visibleControls.map((control) => control.id));
  return documents.filter((document) => (document.linkedControlId ? visibleControlIds.has(document.linkedControlId) : false) || document.ownerId === user.id);
}

export function normalizeControlScopeStatus(value: string | null | undefined): ControlScopeStatus {
  return value?.trim().toUpperCase() === "OUT_OF_SCOPE" ? "OUT_OF_SCOPE" : "IN_SCOPE";
}
