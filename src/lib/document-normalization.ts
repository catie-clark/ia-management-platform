import type { AuditDocument, Control, Question, Request, User } from "@/types/audit";

const artifactDocumentTypes = new Set<AuditDocument["type"]>([
  "PLANNING_NARRATIVE",
  "PLANNING_TOLLGATE",
  "FIELDWORK_TOLLGATE",
  "TOLLGATE",
  "REPORT",
]);

export function normalizeAuditDocuments(args: {
  controls: Control[];
  documents: AuditDocument[];
  questions?: Question[];
  requests?: Request[];
  users?: User[];
  preferredAicUserId?: string | null;
}) {
  const controlMap = new Map(args.controls.map((control) => [control.id, control]));
  const questionMap = new Map((args.questions ?? []).map((question) => [question.id, question]));
  const requestMap = new Map((args.requests ?? []).map((request) => [request.id, request]));
  const preferredAicUserId = args.preferredAicUserId ?? findAicUserId(args.users ?? []) ?? "U1";

  return args.documents.map((document) => {
    const derivedControlId =
      document.linkedControlId ??
      (document.linkedQuestionId ? questionMap.get(document.linkedQuestionId)?.controlId : undefined) ??
      (document.linkedRequestId ? requestMap.get(document.linkedRequestId)?.controlId : undefined);
    const linkedControl = derivedControlId ? controlMap.get(derivedControlId) : undefined;
    const ownerId = artifactDocumentTypes.has(document.type)
      ? preferredAicUserId
      : linkedControl?.ownerId ?? document.ownerId;

    return {
      ...document,
      linkedControlId: document.type === "WORKPAPER" ? derivedControlId ?? document.linkedControlId : derivedControlId ?? document.linkedControlId,
      ownerId,
    };
  });
}

export function findAicUserId(users: User[]) {
  return (
    users.find((user) => user.name.trim().toLowerCase() === "jordan lee" && user.role === "AIC")?.id ??
    users.find((user) => user.role === "AIC")?.id ??
    null
  );
}
