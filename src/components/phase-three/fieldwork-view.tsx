"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ClipboardCheck, FilePenLine, FileSearch, Link2, Send, Workflow } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { useActiveUser } from "@/components/layout/active-user-context";
import { PhaseCompletionCard } from "@/components/phase-three/phase-completion-card";
import { DetailPanel } from "@/components/ui/detail-panel";
import { useNotification } from "@/components/ui/notification-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import { getQuestionDisplayStatus, getRequestDisplayStatus } from "@/lib/audit-logic";
import type { FieldworkViewModel } from "@/lib/fieldwork-data";
import { getEmptyWorkpaperContent } from "@/lib/workpaper-content";
import { cn, formatDateTime, formatShortDate } from "@/lib/utils";
import type { AuditDocument, Control, DocumentReviewStatus, Question, Request, User, WorkpaperContent } from "@/types/audit";

const workflowStages: DocumentReviewStatus[] = ["NOT_SUBMITTED", "AIC_REVIEW", "MANAGER_REVIEW", "DIRECTOR_REVIEW", "APPROVED"];

export function FieldworkView({
  viewModel,
}: {
  viewModel: FieldworkViewModel;
}) {
  const router = useRouter();
  const { activeUser } = useActiveUser();
  const { showNotification } = useNotification();
  const [isPending, startUiTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string>("");
  const [reviewComment, setReviewComment] = useState("");
  const [documentRows, setDocumentRows] = useState(viewModel.documents);
  const [workpaperDraft, setWorkpaperDraft] = useState<WorkpaperContent>(getEmptyWorkpaperContent());

  useEffect(() => {
    setDocumentRows(viewModel.documents);
  }, [viewModel.documents]);

  const fieldworkDocuments = useMemo(
    () =>
      documentRows
        .filter((document) => document.type === "WORKPAPER" || document.type === "EVIDENCE")
        .sort((left, right) => {
          const leftTime = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          const rightTime = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          return leftTime - rightTime || left.title.localeCompare(right.title);
        }),
    [documentRows],
  );
  const workpapers = useMemo(() => fieldworkDocuments.filter((document) => document.type === "WORKPAPER"), [fieldworkDocuments]);
  const selectedDocument = fieldworkDocuments.find((document) => document.id === selectedId) ?? null;
  const linkedBlockers = selectedDocument ? getLinkedBlockers(selectedDocument, viewModel.controls, viewModel.questions, viewModel.requests, viewModel.now) : [];
  const canPersist = viewModel.mode === "live" && Boolean(viewModel.auditId);
  const canEditSelectedWorkpaper = Boolean(selectedDocument && selectedDocument.type === "WORKPAPER");

  useEffect(() => {
    if (!selectedDocument || selectedDocument.type !== "WORKPAPER") {
      setWorkpaperDraft(getEmptyWorkpaperContent());
      setReviewComment("");
      return;
    }

    setWorkpaperDraft({
      ...getEmptyWorkpaperContent(),
      ...selectedDocument.workpaperContent,
    });
    setReviewComment("");
  }, [selectedDocument]);

  const approvedCount = workpapers.filter((document) => document.reviewStatus === "APPROVED").length;
  const inReviewCount = workpapers.filter((document) => {
    const reviewStatus = document.reviewStatus ?? "NOT_SUBMITTED";
    return reviewStatus !== "APPROVED" && reviewStatus !== "NOT_SUBMITTED";
  }).length;
  const atRiskCount = fieldworkDocuments.filter((document) => isAtRisk(document, linkedSignalsForDocument(document, viewModel.controls, viewModel.questions, viewModel.requests, viewModel.now), viewModel.now)).length;

  return (
    <div className="grid gap-6">
      <PhaseCompletionCard
        auditId={viewModel.auditId}
        auditLabel={viewModel.auditLabel}
        auditStatus={viewModel.auditStatus}
        currentPhase={viewModel.currentPhase}
        pagePhase="Fieldwork"
      />

      <PageHeader
        eyebrow="Phase 3"
        title="Fieldwork"
        scopePeriodLabel={viewModel.auditPeriodLabel}
        description="Fieldwork now keeps workpaper drafting and review inside the app so authors can complete, refine, and route execution support without a file handoff loop."
        phaseStatus={{
          label: viewModel.currentPhase === "Fieldwork" ? "Active" : `Current phase: ${viewModel.currentPhase}`,
          active: viewModel.currentPhase === "Fieldwork",
        }}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<FileSearch size={18} />} label="Tracked documents" value={`${fieldworkDocuments.length}`} detail="Workpapers and evidence currently active in fieldwork." tone="neutral" />
        <MetricCard icon={<ClipboardCheck size={18} />} label="Approved workpapers" value={`${approvedCount}`} detail="Workpapers that cleared director review and are ready for reporting use." tone="success" />
        <MetricCard icon={<Workflow size={18} />} label="In review" value={`${inReviewCount}`} detail="Workpapers currently with AIC, manager, or director review." tone="warning" />
        <MetricCard icon={<Link2 size={18} />} label="At risk" value={`${atRiskCount}`} detail="Documents with overdue dates or unresolved linked blockers." tone="risk" />
      </section>

      <div className="grid gap-6 2xl:grid-cols-[0.78fr_1.22fr]">
        <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Workflow progression</p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">Review stages across active workpapers</h2>
          <div className="mt-6 grid gap-4">
            {workflowStages.map((stage) => {
              const stageItems = workpapers.filter((document) => (document.reviewStatus ?? "NOT_SUBMITTED") === stage);

              return (
                <div key={stage} className="rounded-[22px] bg-[var(--surface-tint)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{formatReviewStatus(stage)}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{stageItems.length} workpapers</p>
                    </div>
                    <StatusBadge status={`${stageItems.length}`} tone={getReviewTone(stage)} />
                  </div>
                  <div className="mt-4 grid gap-2">
                    {stageItems.length > 0 ? (
                      stageItems.map((document) => (
                        <button
                          key={document.id}
                          type="button"
                          onClick={() => setSelectedId(document.id)}
                          className="rounded-[18px] bg-white px-4 py-3 text-left transition-transform duration-200 hover:-translate-y-0.5"
                        >
                          <p className="text-sm font-semibold text-[var(--foreground)]">{document.displayId ?? document.id} · {document.title}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">{getOwnerName(document.ownerId, viewModel.users)}</p>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--muted)]">No workpapers currently sit in this stage.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Execution queue</p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">Open a fieldwork document and work it directly in the app</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  <th className="px-4">Document</th>
                  <th className="px-4">Owner</th>
                  <th className="px-4">Due</th>
                  <th className="px-4">Review stage</th>
                  <th className="px-4">Linked blockers</th>
                  <th className="px-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {fieldworkDocuments.map((document) => {
                  const blockers = linkedSignalsForDocument(document, viewModel.controls, viewModel.questions, viewModel.requests, viewModel.now);
                  const reviewStatus = document.reviewStatus ?? "NOT_SUBMITTED";

                  return (
                    <tr key={document.id} className="bg-[#fcfbf8] shadow-[0_12px_34px_rgba(1,30,65,0.06)]">
                      <td className="rounded-l-3xl px-4 py-4">
                        <p className="text-sm font-semibold text-[var(--foreground)]">{document.displayId ?? document.id}</p>
                        <p className="mt-1 text-sm text-[var(--foreground)]">{document.title}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{document.type === "WORKPAPER" ? "Structured workpaper" : "Evidence support"}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-[var(--muted)]">{getOwnerName(document.ownerId, viewModel.users)}</td>
                      <td className="px-4 py-4 text-sm text-[var(--muted)]">{document.dueDate ? formatShortDate(document.dueDate) : "TBD"}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={formatReviewStatus(reviewStatus)} tone={getReviewTone(reviewStatus)} />
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={`${blockers.length} open`} tone={blockers.length > 0 ? "risk" : "success"} />
                      </td>
                      <td className="rounded-r-3xl px-4 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedId(document.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand-indigo-core)]"
                        >
                          {document.type === "WORKPAPER" ? "Open editor" : "Inspect"}
                          <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selectedDocument ? (
        <DetailPanel
          title={`${selectedDocument.displayId ?? selectedDocument.id} · ${selectedDocument.title}`}
          subtitle={
            selectedDocument.type === "WORKPAPER"
              ? "Structured workpaper editing, review routing, and blocker context now stay inside the fieldwork workspace."
              : "Evidence remains inspectable here, but workpaper drafting and review are handled directly in the app."
          }
          open={Boolean(selectedDocument)}
          onClose={() => setSelectedId("")}
          panelClassName={selectedDocument.type === "WORKPAPER" ? "max-w-[72rem] bg-[#f8f6f1]" : undefined}
        >
          {selectedDocument.type === "WORKPAPER" ? (
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="grid gap-6">
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
                        disabled={!canEditSelectedWorkpaper || isPending}
                        className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FilePenLine size={15} />
                        Save draft
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewAction("send_to_review")}
                        disabled={!canEditSelectedWorkpaper || isPending || (selectedDocument.reviewStatus ?? "NOT_SUBMITTED") !== "NOT_SUBMITTED"}
                        className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Send size={15} />
                        Send to AIC review
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4">
                    <EditorField
                      label="Summary"
                      hint="Short framing statement for what this workpaper covers."
                      value={workpaperDraft.summary}
                      onChange={(value) => setWorkpaperDraft((current) => ({ ...current, summary: value }))}
                    />
                    <EditorField
                      label="Objective"
                      value={workpaperDraft.objective}
                      onChange={(value) => setWorkpaperDraft((current) => ({ ...current, objective: value }))}
                    />
                    <EditorField
                      label="Scope or population context"
                      value={workpaperDraft.scope}
                      onChange={(value) => setWorkpaperDraft((current) => ({ ...current, scope: value }))}
                    />
                    <EditorField
                      label="Procedures performed"
                      value={workpaperDraft.procedures}
                      onChange={(value) => setWorkpaperDraft((current) => ({ ...current, procedures: value }))}
                    />
                    <EditorField
                      label="Results or observations"
                      value={workpaperDraft.results}
                      onChange={(value) => setWorkpaperDraft((current) => ({ ...current, results: value }))}
                    />
                    <EditorField
                      label="Conclusion"
                      value={workpaperDraft.conclusion}
                      onChange={(value) => setWorkpaperDraft((current) => ({ ...current, conclusion: value }))}
                    />
                    <EditorField
                      label="Next step"
                      value={workpaperDraft.nextSteps}
                      onChange={(value) => setWorkpaperDraft((current) => ({ ...current, nextSteps: value }))}
                    />
                  </div>
                </section>

                <section className="rounded-[24px] border border-black/5 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Linked blockers and support context</p>
                  <div className="mt-4 grid gap-3">
                    {linkedBlockers.length > 0 ? (
                      linkedBlockers.map((item) => (
                        <div key={item.id} className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-[var(--foreground)]">{item.id} · {item.title}</p>
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

              <div className="grid gap-6">
                <section className="rounded-[24px] border border-black/5 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Document context</p>
                  <div className="mt-4 grid gap-4">
                    <InfoCard label="Owner" value={getOwnerName(selectedDocument.ownerId, viewModel.users)} />
                    <InfoCard label="Due date" value={selectedDocument.dueDate ? formatDateTime(selectedDocument.dueDate) : "Not set"} />
                    <InfoCard label="Linked control" value={getLinkedControlLabel(selectedDocument, viewModel.controls)} />
                    <InfoCard label="Review stage" value={formatReviewStatus(selectedDocument.reviewStatus ?? "NOT_SUBMITTED")} />
                    <InfoCard label="Last update" value={selectedDocument.updatedAt ? formatDateTime(selectedDocument.updatedAt) : "Not saved yet"} />
                  </div>
                </section>

                <section className="rounded-[24px] border border-black/5 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Review workflow</p>
                  <div className="mt-4 grid gap-2">
                    {workflowStages.map((stage, index) => {
                      const currentIndex = workflowStages.indexOf(selectedDocument.reviewStatus ?? "NOT_SUBMITTED");
                      const tone = index < currentIndex ? "success" : index === currentIndex ? "warning" : "neutral";
                      return <StatusBadge key={stage} status={formatReviewStatus(stage)} tone={tone} className="justify-center py-2" />;
                    })}
                  </div>

                  {canReview(selectedDocument.reviewStatus ?? "NOT_SUBMITTED", activeUser.role) ? (
                    <div className="mt-4 rounded-[20px] bg-[var(--surface-tint)] p-4">
                      <p className="text-sm font-semibold text-[var(--foreground)]">Review actions for {activeUser.name}</p>
                      <textarea
                        value={reviewComment}
                        onChange={(event) => setReviewComment(event.target.value)}
                        rows={4}
                        placeholder="Optional approval note or required send-back comment."
                        className="mt-3 w-full resize-none rounded-[18px] border border-black/5 bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none"
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

                  {selectedDocument.reviewComment ? (
                    <div className="mt-4 rounded-[20px] bg-[var(--surface-tint)] p-4">
                      <p className="text-sm font-semibold text-[var(--foreground)]">Latest review note</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{selectedDocument.reviewComment}</p>
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        {selectedDocument.reviewCommentAuthor ?? "Reviewer"}
                        {selectedDocument.reviewCommentDate ? ` · ${formatDateTime(selectedDocument.reviewCommentDate)}` : ""}
                      </p>
                    </div>
                  ) : null}
                </section>
              </div>
            </div>
          ) : (
            <EvidenceInspectPanel document={selectedDocument} linkedBlockers={linkedBlockers} users={viewModel.users} />
          )}
        </DetailPanel>
      ) : null}
    </div>
  );

  function handleSaveDraft() {
    if (!selectedDocument || selectedDocument.type !== "WORKPAPER") {
      return;
    }

    if (!canPersist || !viewModel.auditId) {
      setDocumentRows((current) =>
        current.map((document) =>
          document.id === selectedDocument.id
            ? {
                ...document,
                previewSummary: workpaperDraft.summary || document.previewSummary,
                reviewStatus: document.reviewStatus ?? "NOT_SUBMITTED",
                status: document.status === "COMPLETE" ? "COMPLETE" : "IN_PROGRESS",
                updatedAt: new Date().toISOString(),
                workpaperContent: workpaperDraft,
              }
            : document,
        ),
      );
      showNotification({
        title: "Draft saved",
        message: "The prototype workpaper was updated in local state.",
        tone: "success",
      });
      return;
    }

    startUiTransition(async () => {
      try {
        const response = await fetch(`/api/audits/${viewModel.auditId}/workpapers/${selectedDocument.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: workpaperDraft,
          }),
        });
        const result = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to save the workpaper draft.");
        }

        setDocumentRows((current) =>
          current.map((document) =>
            document.id === selectedDocument.id
              ? {
                  ...document,
                  previewSummary: workpaperDraft.summary || document.previewSummary,
                  status: document.status === "COMPLETE" ? "COMPLETE" : "IN_PROGRESS",
                  updatedAt: new Date().toISOString(),
                  workpaperContent: workpaperDraft,
                }
              : document,
          ),
        );
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
    if (!selectedDocument || selectedDocument.type !== "WORKPAPER") {
      return;
    }

    if (!canPersist || !viewModel.auditId) {
      const nextReviewStatus = getPrototypeNextReviewStatus(selectedDocument.reviewStatus ?? "NOT_SUBMITTED", action);
      setDocumentRows((current) =>
        current.map((document) =>
          document.id === selectedDocument.id
            ? {
                ...document,
                reviewComment: action === "send_back" ? reviewComment.trim() : undefined,
                reviewCommentAuthor: action === "send_back" ? activeUser.name : undefined,
                reviewCommentDate: action === "send_back" ? new Date().toISOString() : undefined,
                reviewStatus: nextReviewStatus,
                status: nextReviewStatus === "APPROVED" ? "COMPLETE" : "IN_PROGRESS",
                updatedAt: new Date().toISOString(),
                workpaperContent: workpaperDraft,
              }
            : document,
        ),
      );
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
        const response = await fetch(`/api/audits/${viewModel.auditId}/workpapers/${selectedDocument.id}/review`, {
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
        const result = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to update the workpaper review workflow.");
        }

        const nextReviewStatus = getPrototypeNextReviewStatus(selectedDocument.reviewStatus ?? "NOT_SUBMITTED", action);
        setDocumentRows((current) =>
          current.map((document) =>
            document.id === selectedDocument.id
              ? {
                  ...document,
                  reviewComment: action === "send_back" ? reviewComment.trim() : undefined,
                  reviewCommentAuthor: action === "send_back" ? activeUser.name : undefined,
                  reviewCommentDate: action === "send_back" ? new Date().toISOString() : undefined,
                  reviewStatus: nextReviewStatus,
                  status: nextReviewStatus === "APPROVED" ? "COMPLETE" : "IN_PROGRESS",
                  updatedAt: new Date().toISOString(),
                  workpaperContent: workpaperDraft,
                }
              : document,
          ),
        );
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

function MetricCard({
  detail,
  icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: React.ReactNode;
  label: string;
  tone: "neutral" | "warning" | "risk" | "success";
  value: string;
}) {
  return (
    <article className="rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{label}</p>
        <span className="text-[var(--brand-indigo-core)]">{icon}</span>
      </div>
      <div className="mt-3 flex items-end gap-3">
        <p className="text-3xl font-semibold text-[var(--foreground)]">{value}</p>
        <StatusBadge status={label} tone={tone} />
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">{detail}</p>
    </article>
  );
}

function EditorField({
  hint,
  label,
  onChange,
  value,
}: {
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
        onChange={(event) => onChange(event.target.value)}
        rows={label === "Summary" ? 3 : 5}
        className="w-full resize-none rounded-[20px] border border-black/5 bg-[#fcfbf8] px-4 py-3 text-sm leading-6 text-[var(--foreground)] outline-none"
      />
    </label>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-black/5 bg-[var(--surface-tint)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function EvidenceInspectPanel({
  document,
  linkedBlockers,
  users,
}: {
  document: AuditDocument;
  linkedBlockers: Array<{ id: string; title: string; detail: string; status: string; tone: "warning" | "risk" | "success" }>;
  users: User[];
}) {
  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-2">
        <InfoCard label="Owner" value={getOwnerName(document.ownerId, users)} />
        <InfoCard label="Type" value="Evidence support" />
        <InfoCard label="Due date" value={document.dueDate ? formatDateTime(document.dueDate) : "Not set"} />
        <InfoCard label="Review stage" value={formatReviewStatus(document.reviewStatus ?? "NOT_SUBMITTED")} />
      </section>

      <section className="rounded-[24px] border border-black/5 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Preview</p>
        <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">{document.previewSummary ?? "No preview summary is available for this evidence item."}</p>
        <div className="mt-4 grid gap-3">
          {(document.previewSections ?? []).map((section) => (
            <div key={section.heading} className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--foreground)]">{section.heading}</p>
              <div className="mt-2 grid gap-2">
                {section.body.map((entry, index) => (
                  <p key={`${section.heading}-${index}`} className="text-sm leading-6 text-[var(--muted)]">
                    {entry}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-black/5 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Linked blockers and evidence context</p>
        <div className="mt-4 grid gap-3">
          {linkedBlockers.length > 0 ? (
            linkedBlockers.map((item) => (
              <div key={item.id} className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{item.id} · {item.title}</p>
                  <StatusBadge status={item.status} tone={item.tone} />
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">{item.detail}</p>
              </div>
            ))
          ) : (
            <div className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-4 text-sm text-[var(--muted)]">
              No linked blockers are attached to this evidence item.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function getOwnerName(ownerId: string, users: User[]) {
  return users.find((user) => user.id === ownerId)?.name ?? ownerId;
}

function getLinkedControlLabel(document: AuditDocument, controls: Control[]) {
  if (!document.linkedControlId) {
    return "No linked control";
  }

  const control = controls.find((item) => item.id === document.linkedControlId);

  if (!control) {
    return document.linkedControlId;
  }

  return `${control.referenceId ?? control.id} · ${control.name}`;
}

function linkedSignalsForDocument(document: AuditDocument, controls: Control[], questions: Question[], requests: Request[], now: string) {
  return getLinkedBlockers(document, controls, questions, requests, now);
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

function isAtRisk(
  document: AuditDocument,
  linkedBlockers: Array<{ status: string; tone: "warning" | "risk" | "success" }>,
  now: string,
) {
  const dueDatePassed = document.dueDate ? new Date(document.dueDate).getTime() < new Date(now).getTime() : false;
  const unresolvedBlocker = linkedBlockers.some((blocker) => blocker.tone !== "success");
  return dueDatePassed || unresolvedBlocker;
}

function formatReviewStatus(status: DocumentReviewStatus) {
  return status.replaceAll("_", " ");
}

function getReviewTone(status: DocumentReviewStatus): "neutral" | "warning" | "risk" | "success" {
  if (status === "APPROVED") {
    return "success";
  }

  if (status === "NOT_SUBMITTED") {
    return "risk";
  }

  return "warning";
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
