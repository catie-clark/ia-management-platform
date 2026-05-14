import type { AuditDocument, AuditPhase, Control, ControlScopeStatus, Question, Request, User } from "@/types/audit";

export type ControlAudienceFilter = "ASSIGNED" | "ALL";
export type ScopeFilter = "IN_SCOPE" | "OUT_OF_SCOPE" | "UNASSIGNED";

export function canUserSeeAllControls(user: Pick<User, "role">) {
  return user.role === "AIC" || user.role === "MANAGER" || user.role === "DIRECTOR";
}

export function getDefaultControlAudienceFilter(user: Pick<User, "role">): ControlAudienceFilter {
  return canUserSeeAllControls(user) ? "ALL" : "ASSIGNED";
}

export function getDefaultScopeFilter(currentPhase: AuditPhase): ScopeFilter {
  return currentPhase === "Planning" ? "UNASSIGNED" : "IN_SCOPE";
}

export function isControlInScope(control: Pick<Control, "scopeStatus">) {
  return control.scopeStatus === "IN_SCOPE";
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
    const matchesScope = control.scopeStatus === scopeFilter;

    return matchesAudience && matchesScope;
  });
}

export function filterQuestionsForControls(
  questions: Question[],
  visibleControls: Control[],
  user: Pick<User, "name" | "role" | "team">,
  audienceFilter: ControlAudienceFilter,
) {
  if (audienceFilter === "ALL" || canUserSeeAllControls(user)) {
    return questions;
  }

  const visibleControlIds = new Set(visibleControls.map((control) => control.id));
  return questions.filter(
    (question) =>
      visibleControlIds.has(question.controlId) ||
      matchesStakeholderUser(user, question.askedBy) ||
      matchesStakeholderUser(user, question.assignedTo),
  );
}

export function filterRequestsForControls(
  requests: Request[],
  visibleControls: Control[],
  user: Pick<User, "name" | "role" | "team">,
  audienceFilter: ControlAudienceFilter,
) {
  if (audienceFilter === "ALL" || canUserSeeAllControls(user)) {
    return requests;
  }

  const visibleControlIds = new Set(visibleControls.map((control) => control.id));
  return requests.filter(
    (request) => (request.controlId ? visibleControlIds.has(request.controlId) : false) || matchesStakeholderUser(user, request.assignedTo),
  );
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
  const normalized = value?.trim().toUpperCase();

  if (normalized === "IN_SCOPE") {
    return "IN_SCOPE";
  }

  if (normalized === "OUT_OF_SCOPE") {
    return "OUT_OF_SCOPE";
  }

  return "UNASSIGNED";
}

export function matchesStakeholderUser(user: Pick<User, "name" | "team">, stakeholderName: string) {
  const normalizedStakeholder = normalizeStakeholderValue(stakeholderName);
  const normalizedUserName = normalizeStakeholderValue(user.name);
  const normalizedUserTeam = normalizeStakeholderValue(user.team);

  return normalizedStakeholder.length > 0 && (normalizedStakeholder === normalizedUserName || normalizedStakeholder === normalizedUserTeam);
}

function normalizeStakeholderValue(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}
