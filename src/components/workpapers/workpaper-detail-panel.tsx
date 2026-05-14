"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Expand, FilePenLine, Minimize2, Send, X } from "lucide-react";

import { useActiveUser } from "@/components/layout/active-user-context";
import { DetailPanel } from "@/components/ui/detail-panel";
import { useNotification } from "@/components/ui/notification-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  defaultAuditWorkspaceSettings,
  formatReviewWorkflowStageLabel,
  reviewWorkflowStages,
  type AuditWorkspaceSettings,
} from "@/lib/audit-settings";
import type { DashboardMode } from "@/lib/live-audit";
import { buildWorkpaperPreview, getEmptyWorkpaperContent } from "@/lib/workpaper-content";
import { formatDateTime } from "@/lib/utils";
import type { AuditDocument, Control, DocumentReviewStatus, Question, Request, User, WorkpaperContent } from "@/types/audit";

const editableSections: Array<{
  description: string;
  fields: Array<{ key: keyof WorkpaperContent; label: string; rows?: number }>;
  title: string;
}> = [
  {
    title: "Control Details",
    description: "Core control metadata sourced from the RCM and refined here when needed.",
    fields: [
      { key: "controlReference", label: "Control Reference", rows: 2 },
      { key: "keyControl", label: "Key Control (Key/Non-Key)", rows: 2 },
      { key: "typeOfControl", label: "Type of Control", rows: 2 },
      { key: "controlFrequency", label: "Control Frequency", rows: 1 },
      { key: "assertions", label: "Assertion(s)", rows: 2 },
    ],
  },
  {
    title: "Testing Design",
    description: "Document the planned procedures, population, and sampling approach.",
    fields: [
      { key: "descriptionOfTestToBePerformed", label: "Description of Test to Be Performed", rows: 4 },
      { key: "totalPopulationAndSamplingUnits", label: "Total Population and Sampling Units", rows: 3 },
      {
        key: "populationCompletenessConsideration",
        label: "Population Completeness Consideration",
        rows: 3,
      },
      { key: "sampleSizeAndSelectionProcedures", label: "Sample Size and Selection Procedures", rows: 3 },
      { key: "expectedDeviationTypes", label: "Expected Deviation Types", rows: 2 },
    ],
  },
  {
    title: "Execution",
    description: "Capture the work performed and any period-end extension procedures.",
    fields: [
      { key: "documentationOfTesting", label: "Documentation of Testing", rows: 5 },
      {
        key: "extensionOfInterimTestingToEndOfPeriod",
        label: "Extension of Interim Testing to End of Period",
        rows: 4,
      },
    ],
  },
  {
    title: "Deviations",
    description: "Matrix exceptions sync here. Add cause, evaluation, and final conclusion.",
    fields: [
      { key: "deviationDescriptionAndCause", label: "Description of Deviations and Cause", rows: 4 },
      { key: "didDeviationsResultFromFraudOrError", label: "Did Deviations Result From Fraud or Error?", rows: 2 },
      { key: "wereDeviationsIsolatedOrPervasive", label: "Were Deviations Isolated or Pervasive?", rows: 2 },
      { key: "controlEffectivenessConclusion", label: "Control Effectiveness Conclusion", rows: 3 },
    ],
  },
];

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
  workspaceSettings?: AuditWorkspaceSettings;
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
  panelClassName = "top-4 right-4 h-[calc(100dvh-2rem)] max-w-[74rem] overflow-y-auto rounded-[16px] border border-black/10 bg-[#f6f1e8] sm:p-4",
  questions,
  requests,
  users,
  workspaceSettings,
}: WorkpaperDetailPanelProps) {
  const router = useRouter();
  const { activeUser } = useActiveUser();
  const { showNotification } = useNotification();
  const [isPending, startUiTransition] = useTransition();
  const [isExpanded, setIsExpanded] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [resolvedWorkspaceSettings, setResolvedWorkspaceSettings] = useState<AuditWorkspaceSettings>(
    workspaceSettings ?? defaultAuditWorkspaceSettings,
  );
  const [workpaperDraft, setWorkpaperDraft] = useState<WorkpaperContent>(getEmptyWorkpaperContent());
  const canPersist = mode === "live" && Boolean(auditId);
  const linkedBlockers = useMemo(
    () => (document ? getLinkedBlockers(document, controls, questions, requests, now) : []),
    [controls, document, now, questions, requests],
  );

  useEffect(() => {
    if (workspaceSettings) {
      setResolvedWorkspaceSettings(workspaceSettings);
      return;
    }

    if (!auditId) {
      setResolvedWorkspaceSettings(defaultAuditWorkspaceSettings);
      return;
    }

    let cancelled = false;

    async function loadWorkspaceSettings() {
      try {
        const response = await fetch(`/api/audits/${auditId}/settings`, { cache: "no-store" });
        const payload = (await response.json()) as { settings?: AuditWorkspaceSettings };

        if (!response.ok) {
          throw new Error("Unable to load workspace settings.");
        }

        if (!cancelled) {
          setResolvedWorkspaceSettings(payload.settings ?? defaultAuditWorkspaceSettings);
        }
      } catch {
        if (!cancelled) {
          setResolvedWorkspaceSettings(defaultAuditWorkspaceSettings);
        }
      }
    }

    void loadWorkspaceSettings();

    const handleSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ auditId?: string; settings?: AuditWorkspaceSettings }>).detail;

      if (detail?.auditId === auditId && detail.settings) {
        setResolvedWorkspaceSettings(detail.settings);
      }
    };

    window.addEventListener("audit-settings-updated", handleSettingsUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener("audit-settings-updated", handleSettingsUpdated);
    };
  }, [auditId, workspaceSettings]);

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

  const syncedDeviationCount = workpaperDraft.numberOfDeviationsDetected || "0";
  const syncedFinalDeviationCount = workpaperDraft.finalNumberOfDeviations || "0";

  const content = (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="grid gap-3">
        <section className="border border-[rgba(1,30,65,0.14)] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(1,30,65,0.05)]">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/10 pb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Testing Workpaper</p>
              <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">{document.title}</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Compact workpaper format with RCM-mapped control details, test steps, and exception tracking.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!isExpanded ? (
                <button
                  type="button"
                  onClick={() => setIsExpanded(true)}
                  className="inline-flex items-center gap-2 rounded-sm border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-indigo-core)]"
                >
                  <Expand size={15} />
                  Expand
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={!canSaveDraft || isPending}
                className="inline-flex items-center gap-2 rounded-sm border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FilePenLine size={15} />
                Save draft
              </button>
              <button
                type="button"
                onClick={() => handleReviewAction("send_to_review")}
                disabled={!canSendToReview || isPending}
                className="inline-flex items-center gap-2 rounded-sm bg-[var(--brand-indigo-core)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send size={15} />
                {`Send to ${formatReviewWorkflowStageLabel("AIC_REVIEW", resolvedWorkspaceSettings)}`}
              </button>
            </div>
          </div>

          <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
            <DocumentMetaField label="Workpaper ID" value={document.displayId ?? document.id} />
            <DocumentMetaField label="Linked Control" value={getLinkedControlLabel(document, controls)} />
            <DocumentMetaField label="Owner" value={getOwnerName(document.ownerId, users)} />
            <DocumentMetaField label="Review Stage" value={formatReviewWorkflowStageLabel(reviewStatus, resolvedWorkspaceSettings)} />
          </dl>

          {readOnly ? (
            <div className="mt-3 border border-[rgba(1,30,65,0.08)] bg-[var(--surface-tint)] px-3 py-2 text-xs text-[var(--muted)]">
              {canAuthor && !canAuthorEdit
                ? "This testing workpaper is locked while it is in review. Editing reopens when it is sent back."
                : "You can inspect this testing workpaper here, but only the assigned control owner or the active reviewer can take action."}
            </div>
          ) : null}
        </section>

        {editableSections.map((section) => (
          <section key={section.title} className="border border-[rgba(1,30,65,0.14)] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(1,30,65,0.05)]">
            <div className="border-b border-black/10 pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{section.title}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{section.description}</p>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {section.fields.map((field) => (
                <EditorField
                  key={field.key}
                  className={field.rows && field.rows >= 4 ? "md:col-span-2" : field.key === "controlReference" ? "md:col-span-2" : undefined}
                  disabled={!canSaveDraft}
                  label={field.label}
                  onChange={(value) =>
                    setWorkpaperDraft((current) => ({
                      ...current,
                      [field.key]: value,
                    }))
                  }
                  rows={field.rows ?? 3}
                  value={workpaperDraft[field.key]}
                />
              ))}

              {section.title === "Deviations" ? (
                <>
                  <ReadOnlyField
                    className="md:col-span-2"
                    label="Matrix Exceptions"
                    rows={4}
                    value={workpaperDraft.matrixExceptionSummary}
                  />
                  <ReadOnlyField label="Number of Deviations Detected" rows={2} value={syncedDeviationCount} />
                  <ReadOnlyField label="Final number of deviations" rows={2} value={syncedFinalDeviationCount} />
                </>
              ) : null}
            </div>
          </section>
        ))}

        <section className="border border-[rgba(1,30,65,0.14)] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(1,30,65,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Linked blockers and support context</p>
          <div className="mt-3 grid gap-2">
            {linkedBlockers.length > 0 ? (
              linkedBlockers.map((item) => (
                <div key={item.id} className="border border-black/5 bg-[var(--surface-tint)] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{item.id} - {item.title}</p>
                    <StatusBadge status={item.status} tone={item.tone} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">{item.detail}</p>
                </div>
              ))
            ) : (
              <div className="border border-black/5 bg-[var(--surface-tint)] px-3 py-3 text-xs text-[var(--muted)]">
                No open linked blockers are attached to this workpaper.
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-3 xl:sticky xl:top-0 xl:self-start">
        <section className="border border-[rgba(1,30,65,0.14)] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(1,30,65,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Review workflow</p>
          <div className="mt-3 grid gap-2">
            {reviewWorkflowStages.map((stage, index) => {
              const currentIndex = reviewWorkflowStages.indexOf(reviewStatus);
              const tone = index < currentIndex ? "success" : index === currentIndex ? "warning" : "neutral";
              return (
                <StatusBadge
                  key={stage}
                  status={formatReviewWorkflowStageLabel(stage, resolvedWorkspaceSettings)}
                  tone={tone}
                  className="justify-center py-2"
                />
              );
            })}
          </div>

          {canActAsReviewer ? (
            <div className="mt-3 border border-black/5 bg-[var(--surface-tint)] p-3">
              <p className="text-sm font-semibold text-[var(--foreground)]">Review actions for {activeUser.name}</p>
              <textarea
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                rows={4}
                placeholder="Optional approval note or required send-back comment."
                className="mt-3 w-full resize-none border border-black/10 bg-white px-3 py-2 text-sm leading-5 text-[var(--foreground)] outline-none"
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleReviewAction("approve")}
                  disabled={isPending}
                  className="rounded-sm bg-[var(--brand-indigo-core)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Approve and advance
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewAction("send_back")}
                  disabled={isPending || reviewComment.trim().length === 0}
                  className="rounded-sm border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Send back
                </button>
              </div>
            </div>
          ) : null}

          {document.reviewComment ? (
            <div className="mt-3 border border-black/5 bg-[var(--surface-tint)] p-3">
              <p className="text-sm font-semibold text-[var(--foreground)]">Latest review note</p>
              <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{document.reviewComment}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {document.reviewCommentAuthor ?? "Reviewer"}
                {document.reviewCommentDate ? ` - ${formatDateTime(document.reviewCommentDate)}` : ""}
              </p>
            </div>
          ) : null}
        </section>

        <section className="border border-[rgba(1,30,65,0.14)] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(1,30,65,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Document context</p>
          <dl className="mt-3 grid gap-2.5">
            <CompactInfoRow label="Owner" value={getOwnerName(document.ownerId, users)} />
            <CompactInfoRow label="Due date" value={document.dueDate ? formatDateTime(document.dueDate) : "Not set"} />
            <CompactInfoRow label="Linked control" value={getLinkedControlLabel(document, controls)} />
            <CompactInfoRow label="Review stage" value={formatReviewWorkflowStageLabel(reviewStatus, resolvedWorkspaceSettings)} />
            <CompactInfoRow label="Last update" value={document.updatedAt ? formatDateTime(document.updatedAt) : "Not saved yet"} />
          </dl>
        </section>
      </div>
    </div>
  );

  const expandedOverlay = isExpanded ? (
    <>
      <button
        type="button"
        aria-label="Close expanded testing workpaper"
        onClick={() => setIsExpanded(false)}
        className="fixed inset-0 z-[70] bg-[rgba(1,30,65,0.28)] backdrop-blur-[2px]"
      />
      <aside className="fixed inset-4 z-[80] flex flex-col overflow-hidden rounded-[14px] border border-black/10 bg-[#f6f1e8] p-4 shadow-[0_24px_80px_rgba(1,30,65,0.22)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Expanded testing workpaper</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{`${document.displayId ?? document.id} - ${document.title}`}</h2>
            <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
              Expanded document view for reviewing more of the testing workpaper at once.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="inline-flex items-center gap-2 rounded-sm border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-indigo-core)]"
            >
              <Minimize2 size={15} />
              Collapse
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-sm border border-black/10 bg-white text-[var(--brand-indigo-core)] transition-colors hover:bg-[var(--surface-tint)]"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">{content}</div>
      </aside>
    </>
  ) : null;

  return (
    <>
      {contained ? (
        <>
          <button
            type="button"
            aria-label="Close workpaper detail"
            onClick={onClose}
            className="absolute inset-0 z-30 bg-[rgba(1,30,65,0.18)] backdrop-blur-[1px]"
          />
          <aside className="absolute inset-y-0 right-0 z-40 flex w-full max-w-[74rem] flex-col overflow-hidden border-l border-black/10 bg-[#f6f1e8] p-4 shadow-[-24px_0_60px_rgba(1,30,65,0.12)] sm:p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Testing workpaper detail</p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{`${document.displayId ?? document.id} - ${document.title}`}</h2>
                <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">RCM-aligned workpaper editing, review routing, and matrix-linked deviations stay inside the workspace.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-sm border border-black/10 bg-white text-[var(--brand-indigo-core)] transition-colors hover:bg-[var(--surface-tint)]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">{content}</div>
          </aside>
        </>
      ) : (
        <DetailPanel
          title={`${document.displayId ?? document.id} - ${document.title}`}
          subtitle="RCM-aligned workpaper editing, review routing, and matrix-linked deviations stay inside the workspace."
          open={Boolean(document)}
          onClose={onClose}
          panelClassName={panelClassName}
        >
          {content}
        </DetailPanel>
      )}
      {expandedOverlay}
    </>
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
        message: "The prototype testing workpaper was updated in local state.",
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
          throw new Error(result.error ?? "Unable to save the testing workpaper draft.");
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
          message: "The testing workpaper content was saved in the app.",
          tone: "success",
        });
        router.refresh();
      } catch (error) {
        showNotification({
          title: "Save failed",
          message: error instanceof Error ? error.message : "There was an error saving the testing workpaper.",
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
        message: getReviewSuccessMessage(action, resolvedWorkspaceSettings),
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
          throw new Error(result.error ?? "Unable to update the testing workpaper review workflow.");
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
          message: getReviewSuccessMessage(action, resolvedWorkspaceSettings),
          tone: "success",
        });
        router.refresh();
      } catch (error) {
        showNotification({
          title: "Workflow update failed",
          message: error instanceof Error ? error.message : "There was an error updating the testing workpaper review workflow.",
          tone: "error",
        });
      }
    });
  }
}

function EditorField({
  className,
  disabled = false,
  label,
  onChange,
  rows,
  value,
}: {
  className?: string;
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  rows: number;
  value: string;
}) {
  return (
    <label className={`grid gap-1.5 ${className ?? ""}`}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</span>
      <textarea
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="w-full resize-none border border-black/10 bg-[#fffdfa] px-3 py-2 text-sm leading-5 text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:opacity-70"
      />
    </label>
  );
}

function ReadOnlyField({
  className,
  label,
  rows,
  value,
}: {
  className?: string;
  label: string;
  rows: number;
  value: string;
}) {
  return (
    <label className={`grid gap-1.5 ${className ?? ""}`}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</span>
      <textarea
        value={value}
        disabled
        rows={rows}
        className="w-full resize-none border border-black/10 bg-[var(--surface-tint)] px-3 py-2 text-sm leading-5 text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:opacity-100"
      />
    </label>
  );
}

function CompactInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-black/10 pb-2 last:border-b-0 last:pb-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</dt>
      <dd className="text-sm font-medium text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

function DocumentMetaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border border-[rgba(1,30,65,0.08)] bg-[#fcfbf8] px-3 py-2">
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
        detail: `Control status: ${control.status}${control.dueDate ? ` | Due ${formatDateTime(control.dueDate)}` : ""}`,
        status: control.status.replace(/_/g, " "),
        tone: control.status === "BLOCKED" ? "risk" : control.status === "COMPLETE" ? "success" : "warning",
      });
    }
  }

  for (const question of questions.filter((item) => item.controlId === document.linkedControlId && item.status !== "RESPONDED")) {
    blockers.push({
      id: question.displayId ?? question.id,
      title: "Open question",
      detail: question.questionText,
      status: question.status,
      tone: question.status === "OVERDUE" ? "risk" : "warning",
    });
  }

  for (const request of requests.filter((item) => item.controlId === document.linkedControlId && item.status !== "COMPLETED")) {
    blockers.push({
      id: request.displayId ?? request.id,
      title: "Open request",
      detail: request.description,
      status: request.status,
      tone: request.status === "OPEN" ? "warning" : "risk",
    });
  }

  return blockers;
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

function isUserMatchedToOwnerId(user: User, ownerId: string, users: User[]) {
  if (!ownerId) {
    return false;
  }

  if (user.id === ownerId) {
    return true;
  }

  return users.find((candidate) => candidate.id === ownerId)?.email === user.email;
}

function normalizeReviewStatus(value: string | undefined) {
  switch (value?.trim().toUpperCase()) {
    case "AIC_REVIEW":
    case "MANAGER_REVIEW":
    case "DIRECTOR_REVIEW":
    case "APPROVED":
    case "NOT_SUBMITTED":
      return value.trim().toUpperCase() as DocumentReviewStatus;
    default:
      return undefined;
  }
}

function normalizeDocumentStatus(value: string | undefined) {
  switch (value?.trim().toUpperCase()) {
    case "NOT_STARTED":
    case "IN_PROGRESS":
    case "COMPLETE":
      return value.trim().toUpperCase() as AuditDocument["status"];
    default:
      return undefined;
  }
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

function getReviewSuccessMessage(
  action: "approve" | "send_back" | "send_to_review",
  workspaceSettings: AuditWorkspaceSettings,
) {
  if (action === "send_to_review") {
    return `The testing workpaper was routed to ${formatReviewWorkflowStageLabel("AIC_REVIEW", workspaceSettings)}.`;
  }

  if (action === "send_back") {
    return "The testing workpaper was sent back with reviewer comment.";
  }

  return "The testing workpaper advanced to the next review step.";
}
