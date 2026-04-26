"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FilePenLine, MessageSquareMore, Plus, Send, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { useActiveUser } from "@/components/layout/active-user-context";
import { PhaseCompletionCard } from "@/components/phase-three/phase-completion-card";
import { DetailPanel } from "@/components/ui/detail-panel";
import { useNotification } from "@/components/ui/notification-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import { canRoleActOnStage, getActiveReviewStage, getFindingControlLabel, getFindingOwnerLabel, getFindingStatusTone } from "@/lib/reporting";
import type { ReportingArtifactDraft, ReportingSummaryCard, ReportingViewModel } from "@/lib/reporting-data";
import { formatDateTime, formatShortDate } from "@/lib/utils";
import type { AuditFinding, ReportArtifactKey, ReportReviewComment, ReportReviewStage, User } from "@/types/audit";

type FindingFormState = {
  dueDate: string;
  impactStatement: string;
  linkedControlId: string;
  managementResponse: string;
  ownerId: string;
  recommendation: string;
  severity: AuditFinding["severity"];
  status: AuditFinding["status"];
  summary: string;
  title: string;
};

const emptyFindingForm: FindingFormState = {
  dueDate: "",
  impactStatement: "",
  linkedControlId: "",
  managementResponse: "",
  ownerId: "",
  recommendation: "",
  severity: "MEDIUM",
  status: "OPEN",
  summary: "",
  title: "",
};

export function ReportingView({
  viewModel,
}: {
  viewModel: ReportingViewModel;
}) {
  const router = useRouter();
  const { activeUser } = useActiveUser();
  const { showNotification } = useNotification();
  const [isPending, startUiTransition] = useTransition();
  const [selectedFindingId, setSelectedFindingId] = useState<string>("");
  const [isNewFindingOpen, setIsNewFindingOpen] = useState(false);
  const [findingForm, setFindingForm] = useState<FindingFormState>(emptyFindingForm);
  const [reportMarkdown, setReportMarkdown] = useState(viewModel.finalReportDraft.markdown);
  const [tollgateMarkdown, setTollgateMarkdown] = useState(viewModel.reportingTollgateDraft.markdown);
  const [reviewCommentInputs, setReviewCommentInputs] = useState<Record<ReportArtifactKey, string>>({
    FINAL_REPORT: "",
    REPORTING_TOLLGATE: "",
  });

  useEffect(() => {
    setReportMarkdown(viewModel.finalReportDraft.markdown);
  }, [viewModel.finalReportDraft.markdown]);

  useEffect(() => {
    setTollgateMarkdown(viewModel.reportingTollgateDraft.markdown);
  }, [viewModel.reportingTollgateDraft.markdown]);

  const selectedFinding = viewModel.findings.find((finding) => finding.id === selectedFindingId) ?? null;

  useEffect(() => {
    if (!selectedFinding) {
      setFindingForm(emptyFindingForm);
      return;
    }

    setFindingForm({
      dueDate: toDateInputValue(selectedFinding.dueDate),
      impactStatement: selectedFinding.impactStatement ?? "",
      linkedControlId: selectedFinding.linkedControlId ?? "",
      managementResponse: selectedFinding.managementResponse ?? "",
      ownerId: selectedFinding.ownerId ?? "",
      recommendation: selectedFinding.recommendation ?? "",
      severity: selectedFinding.severity,
      status: selectedFinding.status,
      summary: selectedFinding.summary,
      title: selectedFinding.title,
    });
  }, [selectedFinding]);

  const canEditLive = viewModel.mode === "live" && Boolean(viewModel.auditId);
  const sortedFindings = useMemo(
    () =>
      viewModel.findings
        .slice()
        .sort((left, right) => {
          const leftSeverity = severityRank(left.severity);
          const rightSeverity = severityRank(right.severity);
          if (leftSeverity !== rightSeverity) {
            return rightSeverity - leftSeverity;
          }

          return (left.displayId ?? left.id).localeCompare(right.displayId ?? right.id);
        }),
    [viewModel.findings],
  );

  return (
    <div className="grid gap-6">
      <PhaseCompletionCard
        auditId={viewModel.auditId}
        auditLabel={viewModel.auditLabel}
        auditStatus={viewModel.auditStatus}
        currentPhase={viewModel.currentPhase}
        pagePhase="Reporting"
      />

      <PageHeader
        eyebrow="Phase 4"
        title="Reporting"
        scopePeriodLabel={viewModel.auditPeriodLabel}
        description="Reporting consolidates findings, draft outputs, and final review workflow so the audit can move from execution into controlled issuance."
        phaseStatus={{
          label: viewModel.currentPhase === "Reporting" ? "Active" : `Current phase: ${viewModel.currentPhase}`,
          active: viewModel.currentPhase === "Reporting",
        }}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {viewModel.summaryCards.map((card) => (
          <SummaryCard key={card.label} card={card} />
        ))}
      </section>

      <div className="grid gap-6 2xl:grid-cols-[0.88fr_1.12fr]">
        <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Findings workspace</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">Audit findings feeding the report</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setFindingForm(emptyFindingForm);
                setSelectedFindingId("");
                setIsNewFindingOpen(true);
              }}
              disabled={!canEditLive}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus size={16} />
              New finding
            </button>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  <th className="px-4">Finding</th>
                  <th className="px-4">Linked control</th>
                  <th className="px-4">Owner</th>
                  <th className="px-4">Due</th>
                  <th className="px-4">Status</th>
                  <th className="px-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedFindings.map((finding) => (
                  <tr key={finding.id} className="bg-[#fcfbf8] shadow-[0_12px_34px_rgba(1,30,65,0.06)]">
                    <td className="rounded-l-3xl px-4 py-4">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{finding.displayId ?? finding.id}</p>
                      <p className="mt-1 text-sm text-[var(--foreground)]">{finding.title}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{finding.severity} severity</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">{getFindingControlLabel(finding, viewModel.controls)}</td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">{getFindingOwnerLabel(finding, viewModel.users)}</td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">{formatShortDate(finding.dueDate)}</td>
                    <td className="px-4 py-4">
                      <StatusBadge status={finding.status} tone={getFindingStatusTone(finding.status)} />
                    </td>
                    <td className="rounded-r-3xl px-4 py-4">
                      <button
                        type="button"
                        onClick={() => setSelectedFindingId(finding.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand-indigo-core)]"
                      >
                        Inspect
                        <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6">
          <ArtifactPanel
            artifactKey="FINAL_REPORT"
            activeUserName={activeUser.name}
            activeUserRole={activeUser.role}
            canEditLive={canEditLive}
            comments={viewModel.reportComments}
            draft={viewModel.finalReportDraft}
            isPending={isPending}
            markdown={reportMarkdown}
            onChangeMarkdown={setReportMarkdown}
            onGenerate={() => handleArtifactGenerate("FINAL_REPORT")}
            onReviewAction={(action) => handleReviewAction("FINAL_REPORT", action)}
            onSave={() => handleArtifactSave("FINAL_REPORT", reportMarkdown, viewModel.finalReportDraft.title)}
            readinessMessage={viewModel.reportReadinessMessage}
            reviewCommentInput={reviewCommentInputs.FINAL_REPORT}
            setReviewCommentInput={(value) => setReviewCommentInputs((current) => ({ ...current, FINAL_REPORT: value }))}
            workflow={viewModel.reportWorkflow}
          />
          <ArtifactPanel
            artifactKey="REPORTING_TOLLGATE"
            activeUserName={activeUser.name}
            activeUserRole={activeUser.role}
            canEditLive={canEditLive}
            comments={viewModel.tollgateComments}
            draft={viewModel.reportingTollgateDraft}
            isPending={isPending}
            markdown={tollgateMarkdown}
            onChangeMarkdown={setTollgateMarkdown}
            onGenerate={() => handleArtifactGenerate("REPORTING_TOLLGATE")}
            onReviewAction={(action) => handleReviewAction("REPORTING_TOLLGATE", action)}
            onSave={() => handleArtifactSave("REPORTING_TOLLGATE", tollgateMarkdown, viewModel.reportingTollgateDraft.title)}
            readinessMessage={viewModel.tollgateReadinessMessage}
            reviewCommentInput={reviewCommentInputs.REPORTING_TOLLGATE}
            setReviewCommentInput={(value) => setReviewCommentInputs((current) => ({ ...current, REPORTING_TOLLGATE: value }))}
            workflow={viewModel.tollgateWorkflow}
          />
        </section>
      </div>

      {selectedFinding ? <FindingDetailPanel
        canEditLive={canEditLive}
        controls={viewModel.controls.map((control) => ({
          id: control.id,
          label: `${control.referenceId ?? control.id} · ${control.name}`,
        }))}
        finding={selectedFinding}
        form={findingForm}
        onChange={setFindingForm}
        onClose={() => setSelectedFindingId("")}
        onSave={() => handleFindingSave(selectedFinding.id)}
        users={viewModel.users}
      /> : null}

      {isNewFindingOpen ? <FindingCreateModal
        canEditLive={canEditLive}
        controls={viewModel.controls.map((control) => ({
          id: control.id,
          label: `${control.referenceId ?? control.id} · ${control.name}`,
        }))}
        form={findingForm}
        onChange={setFindingForm}
        onClose={() => setIsNewFindingOpen(false)}
        onSave={() => handleFindingSave()}
        open={isNewFindingOpen}
        users={viewModel.users}
      /> : null}
    </div>
  );

  function handleFindingSave(findingId?: string) {
    if (!canEditLive || !viewModel.auditId) {
      return;
    }

    startUiTransition(async () => {
      try {
        const response = await fetch(
          findingId ? `/api/audits/${viewModel.auditId}/findings/${findingId}` : `/api/audits/${viewModel.auditId}/findings`,
          {
            method: findingId ? "PATCH" : "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              dueDate: findingForm.dueDate || undefined,
              impactStatement: findingForm.impactStatement,
              linkedControlId: findingForm.linkedControlId,
              managementResponse: findingForm.managementResponse,
              ownerId: findingForm.ownerId,
              recommendation: findingForm.recommendation,
              severity: findingForm.severity,
              status: findingForm.status,
              summary: findingForm.summary,
              title: findingForm.title,
            }),
          },
        );
        const result = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to save the finding.");
        }

        setIsNewFindingOpen(false);
        setSelectedFindingId("");
        showNotification({
          title: "Saved successfully",
          message: findingId ? "The finding was updated." : "The finding was created.",
          tone: "success",
        });
        router.refresh();
      } catch (error) {
        showNotification({
          title: "Save failed",
          message: error instanceof Error ? error.message : "There was an error saving the finding.",
          tone: "error",
        });
      }
    });
  }

  function handleArtifactGenerate(artifactKey: ReportArtifactKey) {
    if (!canEditLive || !viewModel.auditId) {
      return;
    }

    startUiTransition(async () => {
      try {
        const response = await fetch(`/api/audits/${viewModel.auditId}/reporting-artifacts/${artifactKey}`, {
          method: "POST",
        });
        const result = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to generate the draft.");
        }

        showNotification({
          title: "Draft generated",
          message: artifactKey === "FINAL_REPORT" ? "The report draft was refreshed from current audit data." : "The reporting tollgate draft was refreshed from current audit data.",
          tone: "success",
        });
        router.refresh();
      } catch (error) {
        showNotification({
          title: "Generate failed",
          message: error instanceof Error ? error.message : "There was an error generating the draft.",
          tone: "error",
        });
      }
    });
  }

  function handleArtifactSave(artifactKey: ReportArtifactKey, markdown: string, title: string) {
    if (!canEditLive || !viewModel.auditId) {
      return;
    }

    startUiTransition(async () => {
      try {
        const response = await fetch(`/api/audits/${viewModel.auditId}/reporting-artifacts/${artifactKey}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ markdown, title }),
        });
        const result = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to save the draft.");
        }

        showNotification({
          title: "Saved successfully",
          message: artifactKey === "FINAL_REPORT" ? "The report draft was saved." : "The reporting tollgate draft was saved.",
          tone: "success",
        });
        router.refresh();
      } catch (error) {
        showNotification({
          title: "Save failed",
          message: error instanceof Error ? error.message : "There was an error saving the draft.",
          tone: "error",
        });
      }
    });
  }

  function handleReviewAction(artifactKey: ReportArtifactKey, action: "approve" | "send_back" | "resolve_comments") {
    if (!canEditLive || !viewModel.auditId) {
      return;
    }

    startUiTransition(async () => {
      try {
        const response = await fetch(`/api/audits/${viewModel.auditId}/reporting-review/${artifactKey}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            actingRole: activeUser.role,
            actingUserName: activeUser.name,
            comment: reviewCommentInputs[artifactKey],
          }),
        });
        const result = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to update the review workflow.");
        }

        setReviewCommentInputs((current) => ({ ...current, [artifactKey]: "" }));
        showNotification({
          title: "Workflow updated",
          message:
            action === "approve"
              ? "The artifact advanced to the next review step."
              : action === "send_back"
                ? "The artifact was sent back with comment."
                : "Open review comments were resolved and the artifact was resubmitted.",
          tone: "success",
        });
        router.refresh();
      } catch (error) {
        showNotification({
          title: "Workflow update failed",
          message: error instanceof Error ? error.message : "There was an error updating the review workflow.",
          tone: "error",
        });
      }
    });
  }
}

function ArtifactPanel({
  artifactKey,
  activeUserName,
  activeUserRole,
  canEditLive,
  comments,
  draft,
  isPending,
  markdown,
  onChangeMarkdown,
  onGenerate,
  onReviewAction,
  onSave,
  readinessMessage,
  reviewCommentInput,
  setReviewCommentInput,
  workflow,
}: {
  artifactKey: ReportArtifactKey;
  activeUserName: string;
  activeUserRole: User["role"];
  canEditLive: boolean;
  comments: ReportReviewComment[];
  draft: ReportingArtifactDraft;
  isPending: boolean;
  markdown: string;
  onChangeMarkdown: (value: string) => void;
  onGenerate: () => void;
  onReviewAction: (action: "approve" | "send_back" | "resolve_comments") => void;
  onSave: () => void;
  readinessMessage: string;
  reviewCommentInput: string;
  setReviewCommentInput: (value: string) => void;
  workflow: ReportReviewStage[];
}) {
  const activeStage = getActiveReviewStage(workflow);
  const canAct = canRoleActOnStage(activeUserRole, activeStage);
  const openComments = comments.filter((comment) => comment.status !== "RESOLVED");
  const isAicResolving = activeUserRole === "AIC" && openComments.length > 0;

  return (
    <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
            {artifactKey === "FINAL_REPORT" ? "Final report" : "Reporting tollgate"}
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">{draft.title}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{readinessMessage}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <StatusBadge status={draft.status} tone={draft.status === "COMPLETE" ? "success" : draft.status === "IN_PROGRESS" ? "warning" : "risk"} />
          {activeStage ? (
            <StatusBadge status={`${activeStage.reviewerRole} ${activeStage.status}`} tone={activeStage.status === "APPROVED" ? "success" : activeStage.status === "SENT_BACK" ? "risk" : "warning"} />
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-4">
          <div className="rounded-[24px] border border-black/5 bg-[var(--surface-tint)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--foreground)]">Editable draft</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onGenerate}
                  disabled={!canEditLive || isPending}
                  className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Sparkles size={14} />
                  Generate
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={!canEditLive || isPending || markdown.trim().length === 0}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-indigo-core)] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FilePenLine size={14} />
                  Save
                </button>
              </div>
            </div>
            <textarea
              value={markdown}
              onChange={(event) => onChangeMarkdown(event.target.value)}
              rows={16}
              disabled={!canEditLive}
              className="mt-4 w-full resize-none rounded-[20px] border border-black/5 bg-white px-4 py-4 text-sm leading-6 text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:opacity-70"
            />
            <p className="mt-2 text-xs text-[var(--muted)]">
              {draft.updatedAt ? `Last updated ${formatDateTime(draft.updatedAt)}` : "No saved draft yet."}
            </p>
          </div>

          <div className="rounded-[24px] border border-black/5 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Preview summary</p>
            <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">{draft.previewSummary}</p>
            <div className="mt-4 grid gap-3">
              {draft.previewSections.map((section) => (
                <div key={section.heading} className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{section.heading}</p>
                  <div className="mt-2 grid gap-2">
                    {section.body.slice(0, 3).map((entry, index) => (
                      <p key={`${section.heading}-${index}`} className="text-sm leading-6 text-[var(--muted)]">
                        {entry}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[24px] border border-black/5 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Review workflow</p>
            <div className="mt-4 grid gap-3">
              {workflow.map((stage) => (
                <div key={stage.id} className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{stage.reviewerRole}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {stage.actedAt ? `Updated ${formatDateTime(stage.actedAt)}` : "Awaiting action"}
                      </p>
                    </div>
                    <StatusBadge
                      status={stage.status}
                      tone={stage.status === "APPROVED" ? "success" : stage.status === "SENT_BACK" ? "risk" : stage.status === "ACTIVE" ? "warning" : "neutral"}
                    />
                  </div>
                  {stage.actedByName ? <p className="mt-2 text-sm text-[var(--muted)]">Last action by {stage.actedByName}</p> : null}
                  {stage.actionComment ? <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{stage.actionComment}</p> : null}
                </div>
              ))}
            </div>

            {canEditLive && (canAct || isAicResolving) ? (
              <div className="mt-4 rounded-[18px] border border-black/5 bg-[var(--surface-tint)] p-4">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Signed in as {activeUserName} ({activeUserRole})
                </p>
                <textarea
                  value={reviewCommentInput}
                  onChange={(event) => setReviewCommentInput(event.target.value)}
                  rows={4}
                  placeholder="Optional approval note or required send-back comment."
                  className="mt-3 w-full resize-none rounded-[18px] border border-black/5 bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none"
                />
                <div className="mt-4 flex flex-wrap gap-3">
                  {canAct ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onReviewAction("approve")}
                        disabled={isPending}
                        className="rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => onReviewAction("send_back")}
                        disabled={isPending || reviewCommentInput.trim().length === 0}
                        className="rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Send back
                      </button>
                    </>
                  ) : null}
                  {isAicResolving ? (
                    <button
                      type="button"
                      onClick={() => onReviewAction("resolve_comments")}
                      disabled={isPending}
                      className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Send size={14} />
                      Resolve comments and resubmit
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-[24px] border border-black/5 bg-white p-4">
            <div className="flex items-center gap-2">
              <MessageSquareMore size={16} className="text-[var(--brand-indigo-core)]" />
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Review log</p>
            </div>
            <div className="mt-4 grid gap-3">
              {comments.length > 0 ? (
                comments.map((comment) => (
                  <div key={comment.id} className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{comment.authorName}</p>
                      <StatusBadge status={comment.status} tone={comment.status === "RESOLVED" ? "success" : "warning"} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{comment.comment}</p>
                    <p className="mt-3 text-xs text-[var(--muted)]">
                      {comment.authorRole} · {formatDateTime(comment.createdAt)}
                      {comment.resolvedAt ? ` · Resolved ${formatDateTime(comment.resolvedAt)}` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-4 text-sm text-[var(--muted)]">
                  No review comments have been logged for this artifact yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FindingDetailPanel({
  canEditLive,
  controls,
  finding,
  form,
  onChange,
  onClose,
  onSave,
  users,
}: {
  canEditLive: boolean;
  controls: Array<{ id: string; label: string }>;
  finding: AuditFinding | null;
  form: FindingFormState;
  onChange: (next: FindingFormState) => void;
  onClose: () => void;
  onSave: () => void;
  users: User[];
}) {
  return (
    <DetailPanel
      title={finding ? `${finding.displayId ?? finding.id} · ${finding.title}` : ""}
      subtitle="Findings carry the core reporting narrative, ownership, and management response details into the final report package."
      open={Boolean(finding)}
      onClose={onClose}
    >
      {finding ? (
        <FindingForm
          canEditLive={canEditLive}
          controls={controls}
          form={form}
          onChange={onChange}
          onSave={onSave}
          saveLabel="Save finding"
          users={users}
        />
      ) : null}
    </DetailPanel>
  );
}

function FindingCreateModal({
  canEditLive,
  controls,
  form,
  onChange,
  onClose,
  onSave,
  open,
  users,
}: {
  canEditLive: boolean;
  controls: Array<{ id: string; label: string }>;
  form: FindingFormState;
  onChange: (next: FindingFormState) => void;
  onClose: () => void;
  onSave: () => void;
  open: boolean;
  users: User[];
}) {
  return (
    <DetailPanel
      title="New audit finding"
      subtitle="Create the findings that will feed the report draft, tollgate discussion, and final issuance readiness."
      open={open}
      onClose={onClose}
      panelClassName="bottom-4 right-4 top-4 h-auto rounded-[28px] border border-black/5 border-l"
    >
      <FindingForm
        canEditLive={canEditLive}
        controls={controls}
        form={form}
        onChange={onChange}
        onSave={onSave}
        saveLabel="Create finding"
        users={users}
      />
    </DetailPanel>
  );
}

function FindingForm({
  canEditLive,
  controls,
  form,
  onChange,
  onSave,
  saveLabel,
  users,
}: {
  canEditLive: boolean;
  controls: Array<{ id: string; label: string }>;
  form: FindingFormState;
  onChange: (next: FindingFormState) => void;
  onSave: () => void;
  saveLabel: string;
  users: User[];
}) {
  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-2">
        <FormField label="Title">
          <input
            value={form.title}
            onChange={(event) => onChange({ ...form, title: event.target.value })}
            disabled={!canEditLive}
            className="w-full rounded-[18px] border border-black/5 bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:opacity-70"
          />
        </FormField>
        <FormField label="Linked control">
          <select
            value={form.linkedControlId}
            onChange={(event) => onChange({ ...form, linkedControlId: event.target.value })}
            disabled={!canEditLive}
            className="w-full rounded-[18px] border border-black/5 bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:opacity-70"
          >
            <option value="">No linked control</option>
            {controls.map((control) => (
              <option key={control.id} value={control.id}>
                {control.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Severity">
          <select
            value={form.severity}
            onChange={(event) => onChange({ ...form, severity: event.target.value as AuditFinding["severity"] })}
            disabled={!canEditLive}
            className="w-full rounded-[18px] border border-black/5 bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:opacity-70"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </FormField>
        <FormField label="Status">
          <select
            value={form.status}
            onChange={(event) => onChange({ ...form, status: event.target.value as AuditFinding["status"] })}
            disabled={!canEditLive}
            className="w-full rounded-[18px] border border-black/5 bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:opacity-70"
          >
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="READY_FOR_REPORT">Ready for report</option>
            <option value="FINALIZED">Finalized</option>
            <option value="CLOSED">Closed</option>
          </select>
        </FormField>
        <FormField label="Owner">
          <select
            value={form.ownerId}
            onChange={(event) => onChange({ ...form, ownerId: event.target.value })}
            disabled={!canEditLive}
            className="w-full rounded-[18px] border border-black/5 bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:opacity-70"
          >
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Due date">
          <input
            type="date"
            value={form.dueDate}
            onChange={(event) => onChange({ ...form, dueDate: event.target.value })}
            disabled={!canEditLive}
            className="w-full rounded-[18px] border border-black/5 bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:opacity-70"
          />
        </FormField>
      </section>

      <FormField label="Summary">
        <textarea
          value={form.summary}
          onChange={(event) => onChange({ ...form, summary: event.target.value })}
          rows={4}
          disabled={!canEditLive}
          className="w-full resize-none rounded-[18px] border border-black/5 bg-white px-4 py-3 text-sm leading-6 text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:opacity-70"
        />
      </FormField>

      <FormField label="Impact statement">
        <textarea
          value={form.impactStatement}
          onChange={(event) => onChange({ ...form, impactStatement: event.target.value })}
          rows={3}
          disabled={!canEditLive}
          className="w-full resize-none rounded-[18px] border border-black/5 bg-white px-4 py-3 text-sm leading-6 text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:opacity-70"
        />
      </FormField>

      <FormField label="Recommendation">
        <textarea
          value={form.recommendation}
          onChange={(event) => onChange({ ...form, recommendation: event.target.value })}
          rows={3}
          disabled={!canEditLive}
          className="w-full resize-none rounded-[18px] border border-black/5 bg-white px-4 py-3 text-sm leading-6 text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:opacity-70"
        />
      </FormField>

      <FormField label="Management response">
        <textarea
          value={form.managementResponse}
          onChange={(event) => onChange({ ...form, managementResponse: event.target.value })}
          rows={3}
          disabled={!canEditLive}
          className="w-full resize-none rounded-[18px] border border-black/5 bg-white px-4 py-3 text-sm leading-6 text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:opacity-70"
        />
      </FormField>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={!canEditLive || form.title.trim().length === 0 || form.summary.trim().length === 0}
          className="rounded-full bg-[var(--brand-indigo-core)] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

function SummaryCard({ card }: { card: ReportingSummaryCard }) {
  return (
    <article className="rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{card.label}</p>
      <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">{card.value}</p>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{card.detail}</p>
    </article>
  );
}

function FormField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

function severityRank(value: AuditFinding["severity"]) {
  if (value === "HIGH") {
    return 3;
  }

  if (value === "MEDIUM") {
    return 2;
  }

  return 1;
}

function toDateInputValue(value?: string) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}
