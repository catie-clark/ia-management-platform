"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePenLine, Send, X } from "lucide-react";

import { useActiveUser } from "@/components/layout/active-user-context";
import { DetailPanel } from "@/components/ui/detail-panel";
import { useNotification } from "@/components/ui/notification-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import { getQuestionDisplayStatus, getRequestDisplayStatus } from "@/lib/audit-logic";
import type { DashboardMode } from "@/lib/live-audit";
import { buildWorkpaperPreview, getEmptyWorkpaperContent } from "@/lib/workpaper-content";
import { formatDateTime, formatShortDate } from "@/lib/utils";
import type { AuditDocument, Control, DocumentReviewStatus, Question, Request, User, WorkpaperContent } from "@/types/audit";

const workflowStages: DocumentReviewStatus[] = ["NOT_SUBMITTED", "AIC_REVIEW", "MANAGER_REVIEW", "DIRECTOR_REVIEW", "APPROVED"];

type WorkpaperDetailPanelProps = {
  auditId: string | null;
  authorUserId?: string;
  contained?: boolean;
  controls: Control[];
  document: AuditDocument | null;
  mode: DashboardMode;
  now: string;
  onClose: () => void;
  onDocumentUpdated: (nextDocument: AuditDocument) => void;
  panelClassName?: string;
  questions: Question[];
  requests: Request[];
  users: User[];
};

type SaveDraftResponse = {
  document?: {
    previewSections?: Array<{ heading: string; body: string[] }>;
    previewSummary?: string;
    reviewStatus?: string;
    status?: string;
    updatedAt?: string;
  };
  error?: string;
};

type ReviewActionResponse = {
  document?: {
    reviewComment?: string | null;
    reviewCommentAuthor?: string | null;
    reviewCommentDate?: string | null;
    reviewStatus?: string;
    status?: string;
    updatedAt?: string;
  };
  error?: string;
};

export function WorkpaperDetailPanel({
  auditId,
  authorUserId,
  contained = false,
  controls,
  document,
  mode,
  now,
  onClose,
  onDocumentUpdated,
  panelClassName = "top-4 right-4 h-[calc(100dvh-2rem)] max-w-[72rem] overflow-y-auto rounded-[24px] border border-black/5 bg-[#f8f6f1] sm:p-6",
  questions,
  requests,
  users,
}: WorkpaperDetailPanelProps) {
  const router = useRouter();
  const { activeUser } = useActiveUser();
  const { showNotification } = useNotification();
  const [isPending, startUiTransition] = useTransition();
  const [reviewComment, setReviewComment] = useState("");
  const [workpaperDraft, setWorkpaperDraft] = useState<WorkpaperContent>(getEmptyWorkpaperContent());
  const canPersist = mode === "live" && Boolean(auditId);
  const linkedBlockers = useMemo(
    () => (document ? getLinkedBlockers(document, controls, questions, requests, now) : []),
    [controls, document, now, questions, requests],
  );

  useEffect(() => {
    if (!document) {
      setWorkpaperDraft(getEmptyWorkpaperContent());
      setReviewComment("");
      return;
    }

    setWorkpaperDraft({
      ...getEmptyWorkpaperContent(),
      ...document.workpaperContent,
    });
    setReviewComment("");
  }, [document]);

  if (!document || document.type !== "WORKPAPER") {
    return null;
  }

  const reviewStatus = document.reviewStatus ?? "NOT_SUBMITTED";
  const effectiveAuthorUserId = authorUserId ?? getLinkedControlOwnerId(document, controls) ?? document.ownerId;
  const canAuthor =
    !canPersist ||
    !effectiveAuthorUserId ||
    isUserMatchedToOwnerId(activeUser, effectiveAuthorUserId, users) ||
    isUserMatchedToOwnerId(activeUser, document.ownerId, users);
  const canActAsReviewer = canReview(reviewStatus, activeUser.role);
  const canAuthorEdit = canAuthor && isWorkpaperEditableForAuthor(reviewStatus);
  const canSaveDraft = canAuthorEdit;
  const canSendToReview = canAuthor && reviewStatus === "NOT_SUBMITTED";
  const readOnly = !canSaveDraft && !canActAsReviewer;

  const content = (
      <div className="grid gap-5 xl:grid-cols-[1.28fr_0.72fr]">
        <div className="grid gap-5">
          <section className="rounded-[24px] border border-black/5 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Structured editor</p>
                <p className="mt-2 text-sm text-[var(--muted)]">All authoring stays in this workspace. Save drafts as you go, then route the workpaper into review.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={!canSaveDraft || isPending}
                  className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FilePenLine size={15} />
                  Save draft
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewAction("send_to_review")}
                  disabled={!canSendToReview || isPending}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send size={15} />
                  Send to AIC review
                </button>
              </div>
            </div>

            {readOnly ? (
              <div className="mt-5 rounded-[18px] border border-[rgba(1,30,65,0.08)] bg-[var(--surface-tint)] px-4 py-3 text-sm text-[var(--muted)]">
                {canAuthor && !canAuthorEdit
                  ? "This workpaper is locked for the assigned staff author while it is in review. Editing reopens when the workpaper is sent back to staff."
                  : "You can inspect this workpaper here, but only the assigned control owner or the active reviewer can take action."}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4">
              <EditorField
                label="Summary"
                hint="Short framing statement for what this workpaper covers."
                value={workpaperDraft.summary}
                disabled={!canSaveDraft}
                onChange={(value) => setWorkpaperDraft((current) => ({ ...current, summary: value }))}
              />
              <EditorField label="Objective" value={workpaperDraft.objective} disabled={!canSaveDraft} onChange={(value) => setWorkpaperDraft((current) => ({ ...current, objective: value }))} />
              <EditorField label="Scope or population context" value={workpaperDraft.scope} disabled={!canSaveDraft} onChange={(value) => setWorkpaperDraft((current) => ({ ...current, scope: value }))} />
              <EditorField label="Procedures performed" value={workpaperDraft.procedures} disabled={!canSaveDraft} onChange={(value) => setWorkpaperDraft((current) => ({ ...current, procedures: value }))} />
              <EditorField label="Results or observations" value={workpaperDraft.results} disabled={!canSaveDraft} onChange={(value) => setWorkpaperDraft((current) => ({ ...current, results: value }))} />
              <EditorField label="Conclusion" value={workpaperDraft.conclusion} disabled={!canSaveDraft} onChange={(value) => setWorkpaperDraft((current) => ({ ...current, conclusion: value }))} />
              <EditorField label="Next step" value={workpaperDraft.nextSteps} disabled={!canSaveDraft} onChange={(value) => setWorkpaperDraft((current) => ({ ...current, nextSteps: value }))} />
            </div>
          </section>

          <section className="rounded-[22px] border border-black/5 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Linked blockers and support context</p>
            <div className="mt-3 grid gap-2.5">
              {linkedBlockers.length > 0 ? (
                linkedBlockers.map((item) => (
                  <div key={item.id} className="rounded-[16px] bg-[var(--surface-tint)] px-3.5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{item.id} - {item.title}</p>
                      <StatusBadge status={item.status} tone={item.tone} />
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted)]">{item.detail}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-4 text-sm text-[var(--muted)]">
                  No open linked blockers are attached to this workpaper.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-4 xl:sticky xl:top-0 xl:self-start">
          <section className="rounded-[22px] border border-black/5 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Review workflow</p>
            <div className="mt-3 grid gap-2">
              {workflowStages.map((stage, index) => {
                const currentIndex = workflowStages.indexOf(reviewStatus);
                const tone = index < currentIndex ? "success" : index === currentIndex ? "warning" : "neutral";
                return <StatusBadge key={stage} status={formatReviewStatus(stage)} tone={tone} className="justify-center py-2" />;
              })}
            </div>

            {canActAsReviewer ? (
              <div className="mt-3 rounded-[18px] bg-[var(--surface-tint)] p-3.5">
                <p className="text-sm font-semibold text-[var(--foreground)]">Review actions for {activeUser.name}</p>
                <textarea
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  rows={4}
                  placeholder="Optional approval note or required send-back comment."
                  className="mt-3 w-full resize-none rounded-[16px] border border-black/5 bg-white px-3.5 py-3 text-sm text-[var(--foreground)] outline-none"
                />
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleReviewAction("approve")}
                    disabled={isPending}
                    className="rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Approve and advance
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReviewAction("send_back")}
                    disabled={isPending || reviewComment.trim().length === 0}
                    className="rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Send back
                  </button>
                </div>
              </div>
            ) : null}

            {document.reviewComment ? (
              <div className="mt-3 rounded-[18px] bg-[var(--surface-tint)] p-3.5">
                <p className="text-sm font-semibold text-[var(--foreground)]">Latest review note</p>
                <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{document.reviewComment}</p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {document.reviewCommentAuthor ?? "Reviewer"}
                  {document.reviewCommentDate ? ` - ${formatDateTime(document.reviewCommentDate)}` : ""}
                </p>
              </div>
            ) : null}
          </section>

          <section className="rounded-[22px] border border-black/5 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Document context</p>
            <dl className="mt-3 grid gap-2.5">
              <CompactInfoRow label="Owner" value={getOwnerName(document.ownerId, users)} />
              <CompactInfoRow label="Due date" value={document.dueDate ? formatDateTime(document.dueDate) : "Not set"} />
              <CompactInfoRow label="Linked control" value={getLinkedControlLabel(document, controls)} />
              <CompactInfoRow label="Review stage" value={formatReviewStatus(reviewStatus)} />
              <CompactInfoRow label="Last update" value={document.updatedAt ? formatDateTime(document.updatedAt) : "Not saved yet"} />
            </dl>
          </section>
        </div>
      </div>
  );

  if (contained) {
    return (
      <>
        <button
          type="button"
          aria-label="Close workpaper detail"
          onClick={onClose}
          className="absolute inset-0 z-30 bg-[rgba(1,30,65,0.18)] backdrop-blur-[1px]"
        />
        <aside className="absolute inset-y-0 right-0 z-40 flex w-full max-w-[72rem] flex-col overflow-hidden border-l border-black/5 bg-[#f8f6f1] p-6 shadow-[-24px_0_60px_rgba(1,30,65,0.12)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Workpaper detail</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">{`${document.displayId ?? document.id} - ${document.title}`}</h2>
              <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">Structured workpaper editing, review routing, and blocker context now stay inside the workspace.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/5 bg-white text-[var(--brand-indigo-core)] transition-colors hover:bg-[var(--surface-tint)]"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-8 min-h-0 flex-1 overflow-y-auto pr-1">{content}</div>
        </aside>
      </>
    );
  }

  return (
    <DetailPanel
      title={`${document.displayId ?? document.id} - ${document.title}`}
      subtitle="Structured workpaper editing, review routing, and blocker context now stay inside the workspace."
      open={Boolean(document)}
      onClose={onClose}
      panelClassName={panelClassName}
    >
      {content}
    </DetailPanel>
  );

  function handleSaveDraft() {
    if (!document || !canSaveDraft) {
      return;
    }

    const preview = buildWorkpaperPreview(workpaperDraft);

    if (!canPersist || !auditId) {
      onDocumentUpdated({
        ...document,
        previewSections: preview.previewSections,
        previewSummary: preview.previewSummary,
        reviewStatus,
        status: document.status === "COMPLETE" ? "COMPLETE" : "IN_PROGRESS",
        updatedAt: new Date().toISOString(),
        workpaperContent: workpaperDraft,
      });
      showNotification({
        title: "Draft saved",
        message: "The prototype workpaper was updated in local state.",
        tone: "success",
      });
      return;
    }

    startUiTransition(async () => {
      try {
        const response = await fetch(`/api/audits/${auditId}/workpapers/${document.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: workpaperDraft,
          }),
        });
        const result = (await response.json()) as SaveDraftResponse;

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to save the workpaper draft.");
        }

        onDocumentUpdated({
          ...document,
          previewSections: result.document?.previewSections ?? preview.previewSections,
          previewSummary: result.document?.previewSummary ?? preview.previewSummary,
          reviewStatus: normalizeReviewStatus(result.document?.reviewStatus) ?? reviewStatus,
          status: normalizeDocumentStatus(result.document?.status) ?? "IN_PROGRESS",
          updatedAt: result.document?.updatedAt ?? new Date().toISOString(),
          workpaperContent: workpaperDraft,
        });
        showNotification({
          title: "Draft saved",
          message: "The workpaper content was saved in the app.",
          tone: "success",
        });
        router.refresh();
      } catch (error) {
        showNotification({
          title: "Save failed",
          message: error instanceof Error ? error.message : "There was an error saving the workpaper.",
          tone: "error",
        });
      }
    });
  }

  function handleReviewAction(action: "approve" | "send_back" | "send_to_review") {
    if (!document) {
      return;
    }

    const nextReviewStatus = getPrototypeNextReviewStatus(reviewStatus, action);
    const preview = buildWorkpaperPreview(workpaperDraft);

    if (!canPersist || !auditId) {
      onDocumentUpdated({
        ...document,
        previewSections: preview.previewSections,
        previewSummary: preview.previewSummary,
        reviewComment: action === "send_back" ? reviewComment.trim() : undefined,
        reviewCommentAuthor: action === "send_back" ? activeUser.name : undefined,
        reviewCommentDate: action === "send_back" ? new Date().toISOString() : undefined,
        reviewStatus: nextReviewStatus,
        status: nextReviewStatus === "APPROVED" ? "COMPLETE" : "IN_PROGRESS",
        updatedAt: new Date().toISOString(),
        workpaperContent: workpaperDraft,
      });
      setReviewComment("");
      showNotification({
        title: "Workflow updated",
        message: getReviewSuccessMessage(action),
        tone: "success",
      });
      return;
    }

    startUiTransition(async () => {
      try {
        const response = await fetch(`/api/audits/${auditId}/workpapers/${document.id}/review`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            actingRole: activeUser.role,
            actingUserName: activeUser.name,
            comment: reviewComment,
            content: workpaperDraft,
          }),
        });
        const result = (await response.json()) as ReviewActionResponse;

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to update the workpaper review workflow.");
        }

        onDocumentUpdated({
          ...document,
          previewSections: preview.previewSections,
          previewSummary: preview.previewSummary,
          reviewComment: result.document?.reviewComment ?? (action === "send_back" ? reviewComment.trim() : undefined) ?? undefined,
          reviewCommentAuthor: result.document?.reviewCommentAuthor ?? (action === "send_back" ? activeUser.name : undefined) ?? undefined,
          reviewCommentDate: result.document?.reviewCommentDate ?? (action === "send_back" ? new Date().toISOString() : undefined) ?? undefined,
          reviewStatus: normalizeReviewStatus(result.document?.reviewStatus) ?? nextReviewStatus,
          status: normalizeDocumentStatus(result.document?.status) ?? (nextReviewStatus === "APPROVED" ? "COMPLETE" : "IN_PROGRESS"),
          updatedAt: result.document?.updatedAt ?? new Date().toISOString(),
          workpaperContent: workpaperDraft,
        });
        setReviewComment("");
        showNotification({
          title: "Workflow updated",
          message: getReviewSuccessMessage(action),
          tone: "success",
        });
        router.refresh();
      } catch (error) {
        showNotification({
          title: "Workflow update failed",
          message: error instanceof Error ? error.message : "There was an error updating the workpaper review workflow.",
          tone: "error",
        });
      }
    });
  }
}

function EditorField({
  disabled = false,
  hint,
  label,
  onChange,
  value,
}: {
  disabled?: boolean;
  hint?: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</span>
      {hint ? <span className="text-xs text-[var(--muted)]">{hint}</span> : null}
      <textarea
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        rows={label === "Summary" ? 3 : 5}
        className="w-full resize-none rounded-[20px] border border-black/5 bg-[#fcfbf8] px-4 py-3 text-sm leading-6 text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:opacity-70"
      />
    </label>
  );
}

function CompactInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-black/5 pb-2 last:border-b-0 last:pb-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</dt>
      <dd className="text-sm font-medium text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

function getOwnerName(ownerId: string, users: User[]) {
  return users.find((user) => user.id === ownerId)?.name ?? ownerId;
}

function getLinkedControlOwnerId(document: AuditDocument, controls: Control[]) {
  if (!document.linkedControlId) {
    return undefined;
  }

  return controls.find((control) => control.id === document.linkedControlId)?.ownerId;
}

function getLinkedControlLabel(document: AuditDocument, controls: Control[]) {
  if (!document.linkedControlId) {
    return "No linked control";
  }

  const control = controls.find((item) => item.id === document.linkedControlId);

  if (!control) {
    return document.linkedControlId;
  }

  return `${control.referenceId ?? control.id} - ${control.name}`;
}

function getLinkedBlockers(document: AuditDocument, controls: Control[], questions: Question[], requests: Request[], now: string) {
  const blockers: Array<{ id: string; title: string; detail: string; status: string; tone: "warning" | "risk" | "success" }> = [];

  if (document.linkedControlId) {
    const control = controls.find((item) => item.id === document.linkedControlId);
    if (control) {
      blockers.push({
        id: control.referenceId ?? control.id,
        title: control.name,
        detail: `Control status ${control.status.replaceAll("_", " ")} with due date ${control.dueDate ? formatShortDate(control.dueDate) : "TBD"}.`,
        status: control.status,
        tone: control.status === "BLOCKED" ? "risk" : control.status === "COMPLETE" ? "success" : "warning",
      });
    }
  }

  if (document.linkedQuestionId) {
    const question = questions.find((item) => item.id === document.linkedQuestionId);
    if (question) {
      const status = getQuestionDisplayStatus(question, now);
      blockers.push({
        id: question.displayId ?? question.id,
        title: "Linked question",
        detail: question.questionText,
        status,
        tone: status === "RESPONDED" ? "success" : status === "OVERDUE" ? "risk" : "warning",
      });
    }
  }

  if (document.linkedRequestId) {
    const request = requests.find((item) => item.id === document.linkedRequestId);
    if (request) {
      const status = getRequestDisplayStatus(request, now);
      blockers.push({
        id: request.displayId ?? request.id,
        title: "Linked request",
        detail: request.description,
        status,
        tone: status === "COMPLETED" ? "success" : status === "OVERDUE" ? "risk" : "warning",
      });
    }
  }

  return blockers;
}

function formatReviewStatus(status: DocumentReviewStatus) {
  return status.replaceAll("_", " ");
}

function canReview(reviewStatus: DocumentReviewStatus, role: User["role"]) {
  if (reviewStatus === "AIC_REVIEW") {
    return role === "AIC";
  }

  if (reviewStatus === "MANAGER_REVIEW") {
    return role === "MANAGER";
  }

  if (reviewStatus === "DIRECTOR_REVIEW") {
    return role === "DIRECTOR";
  }

  return false;
}

function isWorkpaperEditableForAuthor(reviewStatus: DocumentReviewStatus) {
  return reviewStatus === "NOT_SUBMITTED";
}

function isUserMatchedToOwnerId(activeUser: User, ownerUserId: string | undefined, users: User[]) {
  if (!ownerUserId) {
    return false;
  }

  if (ownerUserId === activeUser.id) {
    return true;
  }

  const ownerUser = users.find((user) => user.id === ownerUserId);

  if (!ownerUser) {
    return false;
  }

  return (
    ownerUser.name.trim().toLowerCase() === activeUser.name.trim().toLowerCase() ||
    ownerUser.email.trim().toLowerCase() === activeUser.email.trim().toLowerCase()
  );
}

function getPrototypeNextReviewStatus(currentReviewStatus: DocumentReviewStatus, action: "approve" | "send_back" | "send_to_review"): DocumentReviewStatus {
  if (action === "send_to_review") {
    return "AIC_REVIEW";
  }

  if (action === "send_back") {
    return "NOT_SUBMITTED";
  }

  if (currentReviewStatus === "AIC_REVIEW") {
    return "MANAGER_REVIEW";
  }

  if (currentReviewStatus === "MANAGER_REVIEW") {
    return "DIRECTOR_REVIEW";
  }

  return "APPROVED";
}

function getReviewSuccessMessage(action: "approve" | "send_back" | "send_to_review") {
  if (action === "send_to_review") {
    return "The workpaper was routed to AIC review.";
  }

  if (action === "send_back") {
    return "The workpaper was sent back with reviewer comment.";
  }

  return "The workpaper advanced to the next review step.";
}

function normalizeReviewStatus(status?: string | null): DocumentReviewStatus | undefined {
  if (
    status === "NOT_SUBMITTED" ||
    status === "AIC_REVIEW" ||
    status === "MANAGER_REVIEW" ||
    status === "DIRECTOR_REVIEW" ||
    status === "APPROVED"
  ) {
    return status;
  }

  return undefined;
}

function normalizeDocumentStatus(status?: string | null): AuditDocument["status"] | undefined {
  if (status === "NOT_STARTED" || status === "IN_PROGRESS" || status === "COMPLETE") {
    return status;
  }

  if (status === "not_started") {
    return "NOT_STARTED";
  }

  if (status === "in_progress") {
    return "IN_PROGRESS";
  }

  if (status === "complete") {
    return "COMPLETE";
  }

  return undefined;
}
