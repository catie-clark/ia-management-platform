"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, MessageSquareMore, Send } from "lucide-react";

import { AttachmentReferencePanel } from "@/components/attachments/attachment-reference-panel";
import { PageHeader } from "@/components/dashboard/page-header";
import { useActiveUser } from "@/components/layout/active-user-context";
import { PhaseCompletionCard } from "@/components/phase-three/phase-completion-card";
import { WorkpaperDetailPanel } from "@/components/workpapers/workpaper-detail-panel";
import { DetailPanel } from "@/components/ui/detail-panel";
import { useNotification } from "@/components/ui/notification-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  getDocumentOwnerName,
  getLinkedBlockers,
  getLinkedControlLabel,
  getReviewTone,
  linkedSignalsForDocument,
} from "@/lib/document-support";
import { sanitizeDraftMarkdown, type NarrativePreviewSection } from "@/lib/planning-narrative/format";
import {
  buildReportingResults,
  canRoleActOnStage,
  getActiveReviewStage,
  getReportReadinessMessage,
  getResultsSummaryCards,
  type ReportingResultItem,
} from "@/lib/reporting";
import type { ReportingArtifactDraft, ReportingSummaryCard, ReportingViewModel } from "@/lib/reporting-data";
import { cn, formatDateTime, formatShortDate } from "@/lib/utils";
import type { AuditDocument, ReportArtifactKey, ReportReviewComment, ReportReviewStage, User } from "@/types/audit";

type ResultFilter = "READY" | "ALL";
type ArtifactViewMode = "preview" | "edit";
type ReportingSubtab = "fieldwork-results" | "reporting-tollgate" | "final-report";

export function ReportingView({
  viewModel,
}: {
  viewModel: ReportingViewModel;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeUser } = useActiveUser();
  const { showNotification } = useNotification();
  const [isPending, startUiTransition] = useTransition();
  const [selectedResultId, setSelectedResultId] = useState("");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("READY");
  const [documentRows, setDocumentRows] = useState(viewModel.documents);
  const [reportMarkdown, setReportMarkdown] = useState(viewModel.finalReportDraft.markdown);
  const [tollgateMarkdown, setTollgateMarkdown] = useState(viewModel.reportingTollgateDraft.markdown);
  const [artifactViewMode, setArtifactViewMode] = useState<Record<ReportArtifactKey, ArtifactViewMode>>({
    FINAL_REPORT: "preview",
    REPORTING_TOLLGATE: "preview",
  });
  const [collapsedArtifacts, setCollapsedArtifacts] = useState<Record<ReportArtifactKey, boolean>>({
    FINAL_REPORT: true,
    REPORTING_TOLLGATE: true,
  });
  const [reviewCommentInputs, setReviewCommentInputs] = useState<Record<ReportArtifactKey, string>>({
    FINAL_REPORT: "",
    REPORTING_TOLLGATE: "",
  });

  useEffect(() => {
    setDocumentRows(viewModel.documents);
  }, [viewModel.documents]);

  useEffect(() => {
    setReportMarkdown(viewModel.finalReportDraft.markdown);
  }, [viewModel.finalReportDraft.markdown]);

  useEffect(() => {
    setTollgateMarkdown(viewModel.reportingTollgateDraft.markdown);
  }, [viewModel.reportingTollgateDraft.markdown]);

  const reportingResults = useMemo(
    () =>
      buildReportingResults({
        controls: viewModel.controls,
        documents: documentRows,
        now: viewModel.now,
        questions: viewModel.questions,
        requests: viewModel.requests,
        users: viewModel.users,
      }),
    [documentRows, viewModel.controls, viewModel.now, viewModel.questions, viewModel.requests, viewModel.users],
  );
  const summaryCards = useMemo(
    () =>
      getResultsSummaryCards({
        documents: documentRows,
        now: viewModel.now,
        questions: viewModel.questions,
        requests: viewModel.requests,
        results: reportingResults,
      }),
    [documentRows, reportingResults, viewModel.now, viewModel.questions, viewModel.requests],
  );
  const visibleResults = useMemo(
    () => (resultFilter === "READY" ? reportingResults.filter((result) => result.isReportingReady) : reportingResults),
    [reportingResults, resultFilter],
  );
  const selectedDocument = documentRows.find((document) => document.id === selectedResultId) ?? null;
  const selectedDocumentControlAttachments = useMemo(
    () =>
      selectedDocument?.linkedControlId
        ? documentRows.filter(
            (document) => document.linkedControlId === selectedDocument.linkedControlId && document.type !== "WORKPAPER",
          )
        : [],
    [documentRows, selectedDocument],
  );
  const linkedBlockers = selectedDocument
    ? getLinkedBlockers(selectedDocument, viewModel.controls, viewModel.questions, viewModel.requests, viewModel.now)
    : [];
  const canEditLive = viewModel.mode === "live" && Boolean(viewModel.auditId);
  const activeSubtab = getReportingSubtab(searchParams.get("reportingTab"));

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <PageHeader
        title="Reporting"
        description=""
        phaseStatus={{
          label: viewModel.currentPhase === "Reporting" ? "Active" : `Current phase: ${viewModel.currentPhase}`,
          active: viewModel.currentPhase === "Reporting",
        }}
        variant="dashboard-compact"
      />

      <PhaseCompletionCard
        auditId={viewModel.auditId}
        auditLabel={viewModel.auditLabel}
        auditStatus={viewModel.auditStatus}
        currentPhase={viewModel.currentPhase}
        pagePhase="Reporting"
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} card={card} />
        ))}
      </section>

      <div className="inline-flex w-fit items-center gap-6">
        {reportingSubtabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => switchSubtab(tab.id)}
            className={cn(
              "border-b-2 pb-1 text-sm transition-colors",
              activeSubtab === tab.id
                ? "border-[var(--brand-indigo-core)] font-semibold text-[var(--brand-indigo-core)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--brand-indigo-core)]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubtab === "fieldwork-results" ? (
        <section className="border border-black/5 bg-white shadow-[0_10px_28px_rgba(1,30,65,0.05)]">
          <div className="border-b border-black/5 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Reporting results</p>
                <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">Fieldwork support feeding the report package</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Review raw workpapers and evidence directly from reporting. Results can be filtered to reporting-ready support or the full fieldwork record.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <FilterPill label="Reporting-ready only" active={resultFilter === "READY"} onClick={() => setResultFilter("READY")} />
                <FilterPill label="All fieldwork results" active={resultFilter === "ALL"} onClick={() => setResultFilter("ALL")} />
              </div>
            </div>
          </div>

          <div className="h-[480px] overflow-auto">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-[var(--surface-strong)]">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  <th className="border-b border-black/5 px-4 py-3">Result</th>
                  <th className="border-b border-black/5 px-4 py-3">Linked control</th>
                  <th className="border-b border-black/5 px-4 py-3">Owner</th>
                  <th className="border-b border-black/5 px-4 py-3">Readiness</th>
                  <th className="border-b border-black/5 px-4 py-3">Open blockers</th>
                  <th className="border-b border-black/5 px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleResults.length > 0 ? (
                  visibleResults.map((result) => (
                    <ResultRow key={result.id} result={result} onOpen={() => setSelectedResultId(result.id)} />
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-sm text-[var(--muted)]">
                      No reporting results are available for the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeSubtab === "reporting-tollgate" ? (
        <ArtifactCard
          artifactKey="REPORTING_TOLLGATE"
          activeUserName={activeUser.name}
          activeUserRole={activeUser.role}
          canEditLive={canEditLive}
          comments={viewModel.tollgateComments}
          draft={viewModel.reportingTollgateDraft}
          isPending={isPending}
          label="Reporting tollgate"
          markdown={tollgateMarkdown}
          onChangeMarkdown={setTollgateMarkdown}
          onGenerate={() => handleArtifactGenerate("REPORTING_TOLLGATE")}
          onReset={() => handleArtifactReset("REPORTING_TOLLGATE")}
          onReviewAction={(action) => handleReviewAction("REPORTING_TOLLGATE", action)}
          onSave={() => handleArtifactSave("REPORTING_TOLLGATE", tollgateMarkdown, viewModel.reportingTollgateDraft.title)}
          readinessMessage={getArtifactReadinessMessage("REPORTING_TOLLGATE")}
          reviewCommentInput={reviewCommentInputs.REPORTING_TOLLGATE}
          setReviewCommentInput={(value) => setReviewCommentInputs((current) => ({ ...current, REPORTING_TOLLGATE: value }))}
          isCollapsed={collapsedArtifacts.REPORTING_TOLLGATE}
          onToggleCollapsed={() => setCollapsedArtifacts((current) => ({ ...current, REPORTING_TOLLGATE: !current.REPORTING_TOLLGATE }))}
          viewMode={artifactViewMode.REPORTING_TOLLGATE}
          setViewMode={(nextMode) => setArtifactViewMode((current) => ({ ...current, REPORTING_TOLLGATE: nextMode }))}
          workflow={viewModel.tollgateWorkflow}
          auditLabel={viewModel.auditLabel}
        />
      ) : null}

      {activeSubtab === "final-report" ? (
        <ArtifactCard
          artifactKey="FINAL_REPORT"
          activeUserName={activeUser.name}
          activeUserRole={activeUser.role}
          canEditLive={canEditLive}
          comments={viewModel.reportComments}
          draft={viewModel.finalReportDraft}
          isPending={isPending}
          label="Final report"
          markdown={reportMarkdown}
          onChangeMarkdown={setReportMarkdown}
          onGenerate={() => handleArtifactGenerate("FINAL_REPORT")}
          onReset={() => handleArtifactReset("FINAL_REPORT")}
          onReviewAction={(action) => handleReviewAction("FINAL_REPORT", action)}
          onSave={() => handleArtifactSave("FINAL_REPORT", reportMarkdown, viewModel.finalReportDraft.title)}
          readinessMessage={getArtifactReadinessMessage("FINAL_REPORT")}
          reviewCommentInput={reviewCommentInputs.FINAL_REPORT}
          setReviewCommentInput={(value) => setReviewCommentInputs((current) => ({ ...current, FINAL_REPORT: value }))}
          isCollapsed={collapsedArtifacts.FINAL_REPORT}
          onToggleCollapsed={() => setCollapsedArtifacts((current) => ({ ...current, FINAL_REPORT: !current.FINAL_REPORT }))}
          viewMode={artifactViewMode.FINAL_REPORT}
          setViewMode={(nextMode) => setArtifactViewMode((current) => ({ ...current, FINAL_REPORT: nextMode }))}
          workflow={viewModel.reportWorkflow}
          auditLabel={viewModel.auditLabel}
        />
      ) : null}

      {selectedDocument?.type === "WORKPAPER" ? (
        <WorkpaperDetailPanel
          auditId={viewModel.auditId}
          controlAttachments={selectedDocumentControlAttachments}
          controls={viewModel.controls}
          document={selectedDocument}
          mode={viewModel.mode}
          now={viewModel.now}
          onClose={() => setSelectedResultId("")}
          onDocumentUpdated={(nextDocument) => {
            setDocumentRows((current) => current.map((document) => (document.id === nextDocument.id ? nextDocument : document)));
          }}
          questions={viewModel.questions}
          requests={viewModel.requests}
          users={viewModel.users}
        />
      ) : null}

      {selectedDocument?.type === "EVIDENCE" ? (
        <DetailPanel
          title={`${selectedDocument.displayId ?? selectedDocument.id} - ${selectedDocument.title}`}
          subtitle="Evidence remains inspectable directly from reporting so reviewers can confirm the support behind the report package."
          open={Boolean(selectedDocument)}
          onClose={() => setSelectedResultId("")}
        >
          <EvidenceInspectPanel
            auditId={viewModel.auditId}
            document={selectedDocument}
            linkedBlockers={linkedBlockers}
            users={viewModel.users}
            controls={viewModel.controls}
          />
        </DetailPanel>
      ) : null}
    </div>
  );

  function getArtifactReadinessMessage(artifactKey: ReportArtifactKey) {
    return artifactKey === "FINAL_REPORT"
      ? getReportReadinessMessage(viewModel.reportWorkflow, viewModel.reportComments.filter((comment) => comment.status !== "RESOLVED"))
      : getReportReadinessMessage(viewModel.tollgateWorkflow, viewModel.tollgateComments.filter((comment) => comment.status !== "RESOLVED"));
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
          message: artifactKey === "FINAL_REPORT" ? "The final report draft was refreshed from current reporting results." : "The reporting tollgate draft was refreshed from current reporting results.",
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
          message: artifactKey === "FINAL_REPORT" ? "The final report draft was saved." : "The reporting tollgate draft was saved.",
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

  function handleArtifactReset(artifactKey: ReportArtifactKey) {
    if (!canEditLive || !viewModel.auditId) {
      return;
    }

    startUiTransition(async () => {
      try {
        const response = await fetch(`/api/audits/${viewModel.auditId}/reporting-artifacts/${artifactKey}`, {
          method: "DELETE",
        });
        const result = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to reset the draft.");
        }

        showNotification({
          title: "Draft reset",
          message: artifactKey === "FINAL_REPORT" ? "The final report draft was reset." : "The reporting tollgate draft was reset.",
          tone: "success",
        });
        router.refresh();
      } catch (error) {
        showNotification({
          title: "Reset failed",
          message: error instanceof Error ? error.message : "There was an error resetting the draft.",
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

  function switchSubtab(nextTab: ReportingSubtab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("reportingTab", nextTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }
}

const reportingSubtabs: Array<{ id: ReportingSubtab; label: string }> = [
  { id: "fieldwork-results", label: "Fieldwork Results" },
  { id: "reporting-tollgate", label: "Reporting Tollgate" },
  { id: "final-report", label: "Final Report" },
];

function getReportingSubtab(value: string | null): ReportingSubtab {
  if (value === "reporting-tollgate" || value === "final-report") {
    return value;
  }

  return "fieldwork-results";
}

function ResultRow({ onOpen, result }: { onOpen: () => void; result: ReportingResultItem }) {
  return (
    <tr className="border-b border-black/5 transition-colors hover:bg-[var(--surface-soft)]">
      <td className="px-4 py-4">
        <p className="text-sm font-semibold text-[var(--foreground)]">{result.displayId}</p>
        <p className="mt-1 text-sm text-[var(--foreground)]">{result.title}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{result.type === "WORKPAPER" ? "Structured workpaper" : "Evidence support"}</p>
      </td>
      <td className="px-4 py-4 text-sm text-[var(--muted)]">{result.linkedControlLabel}</td>
      <td className="px-4 py-4 text-sm text-[var(--muted)]">{result.ownerName}</td>
      <td className="px-4 py-4">
        <div className="grid gap-2">
          <StatusBadge status={result.isReportingReady ? "Reporting ready" : "Needs follow-up"} tone={result.isReportingReady ? "success" : "warning"} />
          <p className="text-xs text-[var(--muted)]">
            {result.type === "WORKPAPER" ? result.reviewStatus.replaceAll("_", " ") : result.updatedAt ? `Updated ${formatShortDate(result.updatedAt)}` : "Evidence status in progress"}
          </p>
        </div>
      </td>
      <td className="px-4 py-4">
        <StatusBadge status={`${result.blockerCount} open`} tone={result.blockerCount > 0 ? result.blockerTone : "success"} />
      </td>
      <td className="px-4 py-4">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand-indigo-core)]"
        >
          Open support
          <ArrowRight size={14} />
        </button>
      </td>
    </tr>
  );
}

function ArtifactCard({
  activeUserName,
  activeUserRole,
  artifactKey,
  auditLabel,
  canEditLive,
  comments,
  draft,
  isPending,
  label,
  markdown,
  onChangeMarkdown,
  onGenerate,
  onToggleCollapsed,
  onReset,
  onReviewAction,
  onSave,
  readinessMessage,
  reviewCommentInput,
  setReviewCommentInput,
  setViewMode,
  isCollapsed,
  viewMode,
  workflow,
}: {
  activeUserName: string;
  activeUserRole: User["role"];
  artifactKey: ReportArtifactKey;
  auditLabel: string;
  canEditLive: boolean;
  comments: ReportReviewComment[];
  draft: ReportingArtifactDraft;
  isPending: boolean;
  label: string;
  markdown: string;
  onChangeMarkdown: (value: string) => void;
  onGenerate: () => void;
  onToggleCollapsed: () => void;
  onReset: () => void;
  onReviewAction: (action: "approve" | "send_back" | "resolve_comments") => void;
  onSave: () => void;
  readinessMessage: string;
  reviewCommentInput: string;
  setReviewCommentInput: (value: string) => void;
  setViewMode: (value: ArtifactViewMode) => void;
  isCollapsed: boolean;
  viewMode: ArtifactViewMode;
  workflow: ReportReviewStage[];
}) {
  const activeStage = getActiveReviewStage(workflow);
  const canAct = canRoleActOnStage(activeUserRole, activeStage);
  const openComments = comments.filter((comment) => comment.status !== "RESOLVED");
  const isAicResolving = activeUserRole === "AIC" && openComments.length > 0;
  const canReset = draft.documentId !== null || draft.markdown.trim().length > 0;
  const isFinalReport = artifactKey === "FINAL_REPORT";
  const title = isFinalReport ? "Generate final audit report draft" : "Generate reporting tollgate draft";
  const generateLabel = isFinalReport ? "Generate final report" : "Generate tollgate";
  const regenerateLabel = isFinalReport ? "Re-generate final report" : "Re-generate reporting tollgate";
  const ownerLabel = "Jordan Lee";
  const reviewSummary = activeStage ? `${activeStage.reviewerRole} ${activeStage.status.replaceAll("_", " ")}` : null;

  return (
    <article className={`border border-black/5 bg-white shadow-[0_10px_28px_rgba(1,30,65,0.05)] ${isCollapsed ? "px-4 py-3" : "p-5"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
          <h2 className={`font-semibold text-[var(--foreground)] ${isCollapsed ? "mt-1 text-lg leading-6" : "mt-2 text-xl"}`}>{title}</h2>
          <p className={isCollapsed ? "mt-1 text-sm leading-6 text-[var(--foreground)]" : "mt-3 text-sm leading-7 text-[var(--foreground)]"}>{readinessMessage}</p>
        </div>
        <div className="flex shrink-0 items-start gap-3">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="inline-flex items-center justify-center rounded-md border border-black/10 bg-white p-2 text-[var(--brand-indigo-core)]"
            aria-label={isCollapsed ? `Expand ${label}` : `Collapse ${label}`}
            aria-expanded={!isCollapsed}
          >
            <ArrowRight size={18} className={`transition-transform duration-200 ${isCollapsed ? "rotate-0" : "rotate-90"}`} />
          </button>
          {!isCollapsed ? (
            <>
              <button
                type="button"
                onClick={onGenerate}
                disabled={!canEditLive || isPending}
                className="inline-flex items-center justify-center rounded-md bg-[var(--brand-indigo-core)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Generating..." : draft.documentId || draft.markdown.trim().length > 0 ? regenerateLabel : generateLabel}
              </button>
              <button
                type="button"
                onClick={onReset}
                disabled={!canEditLive || !canReset || isPending}
                className="inline-flex items-center justify-center rounded-md border border-[rgba(229,55,107,0.18)] bg-[rgba(229,55,107,0.08)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-coral)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Working..." : "Reset draft"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {!isCollapsed ? (
        <>
          <div className="mt-5 grid gap-3">
            <div className="flex flex-wrap items-center gap-2 border border-black/5 bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--muted)]">
              <span>Saved draft: {draft.title}</span>
              <span>{draft.status.replaceAll("_", " ")}</span>
              <span>Owner: {ownerLabel} (AIC)</span>
              {draft.updatedAt ? <span>Updated {formatDateTime(draft.updatedAt)}</span> : null}
              {reviewSummary ? <span>{reviewSummary}</span> : null}
            </div>
          </div>

          <div className="mt-5 grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
            <section className="border border-black/5 bg-[var(--surface-soft)] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="mr-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Draft workspace</p>
                  <button
                    type="button"
                    onClick={() => setViewMode("preview")}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      viewMode === "preview" ? "bg-[var(--brand-indigo-core)] text-white" : "border border-black/10 bg-white text-[var(--muted)]"
                    }`}
                  >
                    Formatted preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("edit")}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      viewMode === "edit" ? "bg-[var(--brand-indigo-core)] text-white" : "border border-black/10 bg-white text-[var(--muted)]"
                    }`}
                  >
                    Editable draft
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => downloadDraftAsWord({ auditLabel, label: draft.title, markdown, previewSections: draft.previewSections, previewSummary: draft.previewSummary })}
                    disabled={markdown.trim().length === 0}
                    className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Export Word
                  </button>
                  {viewMode === "edit" ? (
                    <button
                      type="button"
                      onClick={onSave}
                      disabled={!canEditLive || isPending || markdown.trim().length === 0}
                      className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPending ? "Saving..." : "Save edits"}
                    </button>
                  ) : null}
                </div>
              </div>

              {viewMode === "edit" ? (
                <textarea
                  value={markdown}
                  onChange={(event) => onChangeMarkdown(event.target.value)}
                  rows={18}
                  disabled={!canEditLive}
                  placeholder="Generate a draft, then edit it here."
                  className="mt-4 w-full resize-y border border-black/10 bg-white px-4 py-4 font-mono text-sm leading-7 text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:opacity-70"
                />
              ) : draft.previewSections.length > 0 ? (
                <div className="mt-4 max-h-[520px] overflow-auto">
                  {draft.previewSummary ? (
                    <div className="border border-black/5 bg-white px-4 py-4 text-sm leading-7 text-[var(--foreground)]">{draft.previewSummary}</div>
                  ) : null}
                  <div className="mt-4 grid gap-4">
                    {draft.previewSections.map((section, index) => (
                      <div key={`${section.heading}-${index}`} className="border border-black/5 bg-white px-4 py-4">
                        <h3 className="text-base font-semibold text-[var(--foreground)]">{section.heading}</h3>
                        <div className="mt-3 grid gap-3">
                          {section.body.map((entry, entryIndex) =>
                            entry.startsWith("- ") ? (
                              <div key={`${section.heading}-${entryIndex}`} className="flex gap-2 text-sm leading-7 text-[var(--foreground)]">
                                <span className="pt-[0.35rem] text-[var(--muted)]">&bull;</span>
                                <span>{entry.slice(2)}</span>
                              </div>
                            ) : (
                              <p key={`${section.heading}-${entryIndex}`} className="text-sm leading-7 text-[var(--foreground)]">
                                {entry}
                              </p>
                            ),
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-7 text-[var(--muted)]">No draft content is available yet. Generate a draft from the current reporting results to begin review.</p>
              )}

              <p className="mt-3 text-xs text-[var(--muted)]">
                {draft.updatedAt ? `Last updated ${formatDateTime(draft.updatedAt)}` : "No saved draft yet."}
              </p>
            </section>

            <div className="grid gap-4">
              <section className="border border-black/5 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Review workflow</p>
                    <p className="mt-2 text-sm text-[var(--foreground)]">
                      The {label.toLowerCase()} is assigned to the AIC and routed from Reporting for manager and director approval.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={draft.status} tone={draft.status === "COMPLETE" ? "success" : draft.status === "IN_PROGRESS" ? "warning" : "risk"} />
                    {activeStage ? (
                      <StatusBadge
                        status={`${activeStage.reviewerRole} ${activeStage.status.replaceAll("_", " ")}`}
                        tone={activeStage.status === "APPROVED" ? "success" : activeStage.status === "SENT_BACK" ? "risk" : "warning"}
                      />
                    ) : null}
                  </div>
                </div>
                {workflow.length > 0 ? (
                  <div className="mt-4 grid gap-3">
                    {workflow.map((stage) => (
                      <div key={stage.id} className="border border-black/5 bg-[var(--surface-soft)] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[var(--foreground)]">{stage.reviewerRole}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">{stage.actedAt ? `Updated ${formatDateTime(stage.actedAt)}` : "Awaiting action"}</p>
                          </div>
                          <StatusBadge status={stage.status} tone={stage.status === "APPROVED" ? "success" : stage.status === "SENT_BACK" ? "risk" : stage.status === "ACTIVE" ? "warning" : "neutral"} />
                        </div>
                        {stage.actedByName ? <p className="mt-2 text-sm text-[var(--muted)]">Last action by {stage.actedByName}</p> : null}
                        {stage.actionComment ? <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{stage.actionComment}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 border border-black/5 bg-[var(--surface-soft)] px-4 py-4 text-sm text-[var(--muted)]">
                    No live review workflow rows have been created for this artifact yet.
                  </div>
                )}

                {canEditLive && (canAct || isAicResolving) ? (
                  <div className="mt-4 border border-black/5 bg-[var(--surface-soft)] p-4">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      Signed in as {activeUserName} ({activeUserRole})
                    </p>
                    <textarea
                      value={reviewCommentInput}
                      onChange={(event) => setReviewCommentInput(event.target.value)}
                      rows={4}
                      placeholder="Optional approval note or required send-back comment."
                      className="mt-3 w-full resize-none border border-black/10 bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none"
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
              </section>

              <section className="border border-black/5 bg-white p-4">
                <div className="flex items-center gap-2">
                  <MessageSquareMore size={16} className="text-[var(--brand-indigo-core)]" />
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Review log</p>
                </div>
                <div className="mt-4 grid gap-3">
                  {comments.length > 0 ? (
                    comments.map((comment) => (
                      <div key={comment.id} className="border border-black/5 bg-[var(--surface-soft)] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[var(--foreground)]">{comment.authorName}</p>
                          <StatusBadge status={comment.status} tone={comment.status === "RESOLVED" ? "success" : "warning"} />
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{comment.comment}</p>
                        <p className="mt-3 text-xs text-[var(--muted)]">
                          {comment.authorRole} - {formatDateTime(comment.createdAt)}
                          {comment.resolvedAt ? ` - Resolved ${formatDateTime(comment.resolvedAt)}` : ""}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="border border-black/5 bg-[var(--surface-soft)] px-4 py-4 text-sm text-[var(--muted)]">
                      No review comments have been logged for this artifact yet.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </>
      ) : null}
    </article>
  );
}

function EvidenceInspectPanel({
  auditId,
  controls,
  document,
  linkedBlockers,
  users,
}: {
  auditId: string | null;
  controls: ReportingViewModel["controls"];
  document: AuditDocument;
  linkedBlockers: Array<{ id: string; title: string; detail: string; status: string; tone: "warning" | "risk" | "success" }>;
  users: User[];
}) {
  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-2">
        <InfoCard label="Owner" value={getDocumentOwnerName(document.ownerId, users)} />
        <InfoCard label="Type" value="Evidence support" />
        <InfoCard label="Due date" value={document.dueDate ? formatDateTime(document.dueDate) : "Not set"} />
        <InfoCard label="Linked control" value={getLinkedControlLabel(document, controls)} />
      </section>

      {document.attachment ? (
        <AttachmentReferencePanel
          attachments={[document]}
          auditId={auditId}
          description="Open or download the uploaded evidence file."
          emptyMessage="This evidence item does not have an uploaded file."
          title="Uploaded file"
        />
      ) : null}

      <section className="rounded-[24px] border border-black/5 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Evidence summary</p>
        <p className="mt-4 text-sm leading-7 text-[var(--foreground)]">
          {document.previewSummary ?? "This evidence item is available to support report conclusions and can be traced through its linked control or follow-up records."}
        </p>
      </section>

      <section className="rounded-[24px] border border-black/5 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Linked blockers and support context</p>
        <div className="mt-4 grid gap-3">
          {linkedBlockers.length > 0 ? (
            linkedBlockers.map((item) => (
              <div key={item.id} className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{item.id} - {item.title}</p>
                  <StatusBadge status={item.status} tone={item.tone} />
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{item.detail}</p>
              </div>
            ))
          ) : (
            <div className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-4 text-sm text-[var(--muted)]">
              No open linked blockers are attached to this evidence item.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ card }: { card: ReportingSummaryCard }) {
  return (
    <article className="border border-black/5 bg-white p-5 shadow-[0_8px_24px_rgba(1,30,65,0.05)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{card.label}</p>
      <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">{card.value}</p>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{card.detail}</p>
    </article>
  );
}

function FilterPill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "border-[rgba(1,30,65,0.08)] bg-[var(--brand-indigo-core)] text-white"
          : "border-black/10 bg-white text-[var(--muted)]"
      }`}
    >
      {label}
    </button>
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

function downloadDraftAsWord({
  auditLabel,
  label,
  markdown,
  previewSections,
  previewSummary,
}: {
  auditLabel: string;
  label: string;
  markdown: string;
  previewSections: NarrativePreviewSection[];
  previewSummary: string;
}) {
  const html = buildWordDocumentHtml({
    auditLabel,
    label,
    markdown,
    previewSections,
    previewSummary,
  });
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sanitizeFileName(auditLabel)}-${sanitizeFileName(label)}.doc`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function buildWordDocumentHtml({
  auditLabel,
  label,
  markdown,
  previewSections,
  previewSummary,
}: {
  auditLabel: string;
  label: string;
  markdown: string;
  previewSections: NarrativePreviewSection[];
  previewSummary: string;
}) {
  const bodyHtml =
    previewSections.length > 0
      ? [
          previewSummary ? `<p class="summary">${escapeHtml(previewSummary)}</p>` : "",
          ...previewSections.map(
            (section) => `
              <section>
                <h2>${escapeHtml(section.heading)}</h2>
                ${renderSectionBody(section.body)}
              </section>
            `,
          ),
        ].join("")
      : sanitizeDraftMarkdown(markdown)
          .replace(/\r\n/g, "\n")
          .split("\n")
          .map((line) => {
            const trimmed = line.trim();

            if (trimmed.startsWith("- ")) {
              return `<p class="bullet">&#8226; ${escapeHtml(trimmed.slice(2))}</p>`;
            }

            if (trimmed.length === 0) {
              return `<p class="spacer"></p>`;
            }

            return `<p>${escapeHtml(trimmed)}</p>`;
          })
          .join("");

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(`${auditLabel} ${label}`)}</title>
    <style>
      body { font-family: Calibri, Arial, sans-serif; color: #1f2937; margin: 36pt; line-height: 1.5; }
      h1 { font-size: 20pt; margin: 0 0 18pt; color: #0f2d52; }
      h2 { font-size: 14pt; margin: 18pt 0 8pt; color: #0f2d52; }
      h3 { font-size: 12pt; margin: 14pt 0 6pt; color: #0f2d52; }
      p { font-size: 11pt; margin: 0 0 8pt; }
      p.summary { margin-bottom: 14pt; }
      p.bullet { margin-left: 18pt; text-indent: -12pt; }
      p.spacer { margin: 0 0 8pt; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(label)} - ${escapeHtml(auditLabel)}</h1>
    ${bodyHtml}
  </body>
</html>`;
}

function renderSectionBody(entries: string[]) {
  return entries
    .map((entry) =>
      entry.startsWith("- ")
        ? `<p class="bullet">&#8226; ${escapeHtml(entry.slice(2))}</p>`
        : `<p>${escapeHtml(entry)}</p>`,
    )
    .join("");
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "draft";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
