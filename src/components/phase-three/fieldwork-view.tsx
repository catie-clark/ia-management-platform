"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ClipboardCheck, Expand, FileSearch, Link2, Workflow, X } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { ControlTestingView } from "@/components/phase-two/control-testing-view";
import { useActiveUser } from "@/components/layout/active-user-context";
import { PhaseCompletionCard } from "@/components/phase-three/phase-completion-card";
import { useNotification } from "@/components/ui/notification-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkpaperDetailPanel } from "@/components/workpapers/workpaper-detail-panel";
import { getQuestionDisplayStatus, getRequestDisplayStatus } from "@/lib/audit-logic";
import {
  filterControlsForUser,
  filterDocumentsForControls,
  filterQuestionsForControls,
  filterRequestsForControls,
} from "@/lib/control-visibility";
import { cn } from "@/lib/utils";
import { sanitizeDraftMarkdown, type NarrativePreviewSection } from "@/lib/planning-narrative/format";
import type { FieldworkViewModel } from "@/lib/fieldwork-data";
import { formatDateTime, formatShortDate } from "@/lib/utils";
import type { AuditDocument, Control, DocumentReviewStatus, Question, Request, User } from "@/types/audit";

const workflowStages: DocumentReviewStatus[] = ["NOT_SUBMITTED", "AIC_REVIEW", "MANAGER_REVIEW", "DIRECTOR_REVIEW", "APPROVED"];
const allAuditUser = {
  id: "ALL_AUDIT",
  name: "All Audit Controls",
  role: "DIRECTOR" as const,
};
type FieldworkSubtab = "control-testing" | "view-risks" | "document-review" | "tollgate-draft";

type FieldworkArtifactDraftResponse = {
  draft: {
    documentId: string | null;
    generatedAt: string;
    markdown: string;
    missingRequiredTokens: string[];
    ownerName: string | null;
    ownerRole: string | null;
    previewSections: NarrativePreviewSection[];
    previewSummary: string;
    reviewComment: string | null;
    reviewCommentAuthor: string | null;
    reviewCommentDate: string | null;
    reviewStatus: string;
    status: string;
    templateName: string | null;
    title: string;
  } | null;
};

type FieldworkArtifactReviewResponse = {
  draft: {
    reviewComment: string | null;
    reviewCommentAuthor: string | null;
    reviewCommentDate: string | null;
    reviewStatus: string;
    status: string;
    updatedAt: string;
  };
};

export function FieldworkView({
  viewModel,
}: {
  viewModel: FieldworkViewModel;
}) {
  const { showNotification } = useNotification();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string>("");
  const [documentRows, setDocumentRows] = useState(viewModel.documents);
  const [isTollgateCollapsed, setIsTollgateCollapsed] = useState(true);

  useEffect(() => {
    setDocumentRows(viewModel.documents);
  }, [viewModel.documents]);

  const visibleControls = useMemo(
    () => filterControlsForUser(viewModel.controls, allAuditUser, "ALL", "IN_SCOPE"),
    [viewModel.controls],
  );
  const visibleQuestions = useMemo(
    () => filterQuestionsForControls(viewModel.questions, visibleControls, allAuditUser, "ALL"),
    [viewModel.questions, visibleControls],
  );
  const visibleRequests = useMemo(
    () => filterRequestsForControls(viewModel.requests, visibleControls, allAuditUser, "ALL"),
    [viewModel.requests, visibleControls],
  );
  const visibleDocuments = useMemo(
    () => filterDocumentsForControls(documentRows, visibleControls, allAuditUser, "ALL"),
    [documentRows, visibleControls],
  );
  const fieldworkDocuments = useMemo(
    () =>
      visibleDocuments
        .filter((document) => document.type === "WORKPAPER" || document.type === "EVIDENCE")
        .sort((left, right) => {
          const leftTime = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          const rightTime = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          return leftTime - rightTime || left.title.localeCompare(right.title);
        }),
    [visibleDocuments],
  );
  const workpapers = useMemo(() => fieldworkDocuments.filter((document) => document.type === "WORKPAPER"), [fieldworkDocuments]);
  const selectedDocument = fieldworkDocuments.find((document) => document.id === selectedId) ?? null;
  const linkedBlockers = selectedDocument ? getLinkedBlockers(selectedDocument, visibleControls, visibleQuestions, visibleRequests, viewModel.now) : [];
  const approvedCount = workpapers.filter((document) => document.reviewStatus === "APPROVED").length;
  const inReviewCount = workpapers.filter((document) => {
    const reviewStatus = document.reviewStatus ?? "NOT_SUBMITTED";
    return reviewStatus !== "APPROVED" && reviewStatus !== "NOT_SUBMITTED";
  }).length;
  const atRiskCount = fieldworkDocuments.filter((document) => isAtRisk(document, linkedSignalsForDocument(document, visibleControls, visibleQuestions, visibleRequests, viewModel.now), viewModel.now)).length;
  const activeSubtab = getFieldworkSubtab(searchParams.get("fieldworkTab"));

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <PageHeader
        title="Fieldwork"
        description=""
        phaseStatus={{
          label: viewModel.currentPhase === "Fieldwork" ? "Active" : `Current phase: ${viewModel.currentPhase}`,
          active: viewModel.currentPhase === "Fieldwork",
        }}
        variant="dashboard-compact"
      />

      <PhaseCompletionCard
        auditId={viewModel.auditId}
        auditLabel={viewModel.auditLabel}
        auditStatus={viewModel.auditStatus}
        currentPhase={viewModel.currentPhase}
        pagePhase="Fieldwork"
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<FileSearch size={18} />} label="Tracked documents" value={`${fieldworkDocuments.length}`} detail="Workpapers and evidence currently active in fieldwork." tone="neutral" />
        <MetricCard icon={<ClipboardCheck size={18} />} label="Approved workpapers" value={`${approvedCount}`} detail="Workpapers that cleared director review and are ready for reporting use." tone="success" />
        <MetricCard icon={<Workflow size={18} />} label="In review" value={`${inReviewCount}`} detail="Workpapers currently with AIC, manager, or director review." tone="warning" />
        <MetricCard icon={<Link2 size={18} />} label="At risk" value={`${atRiskCount}`} detail="Documents with overdue dates or unresolved linked blockers." tone="risk" />
      </section>

      <div className="inline-flex w-fit items-center gap-6">
        {fieldworkSubtabs.map((tab) => (
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

      {activeSubtab === "control-testing" ? (
        <ControlTestingView
          auditId={viewModel.auditId}
          auditLabel={viewModel.auditLabel}
          auditPeriodLabel={viewModel.auditPeriodLabel}
          controls={viewModel.controls}
          controlExceptions={viewModel.controlExceptions}
          currentPhase={viewModel.currentPhase}
          documents={documentRows}
          embedded
          mode={viewModel.mode}
          questions={viewModel.questions}
          requests={viewModel.requests}
          testingMatrices={viewModel.testingMatrices}
          users={viewModel.users}
        />
      ) : null}

      {activeSubtab === "view-risks" ? (
        <section className="flex h-[760px] min-h-0 flex-col overflow-hidden border border-black/5 bg-white shadow-[0_10px_28px_rgba(1,30,65,0.05)]">
          <div className="border-b border-black/5 px-5 py-4 sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Imported risk register</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">Risks loaded with the audit</h2>
          </div>
          {viewModel.risks.length > 0 ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="min-w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-[var(--surface-strong)]">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    <th className="border-b border-black/5 px-4 py-3">Risk ID</th>
                    <th className="border-b border-black/5 px-4 py-3">Risk statement</th>
                    <th className="border-b border-black/5 px-4 py-3">Associated controls</th>
                    <th className="border-b border-black/5 px-4 py-3">Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {viewModel.risks.map((risk) => (
                    <tr key={risk.id} className="border-b border-black/5 align-top transition-colors hover:bg-[var(--surface-soft)]">
                      <td className="px-4 py-4 text-sm font-semibold text-[var(--foreground)]">{risk.referenceId}</td>
                      <td className="px-4 py-4 text-sm text-[var(--foreground)]">{risk.statement}</td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold text-[var(--foreground)]">{risk.associatedControls.length}</p>
                        {risk.associatedControls.length > 0 ? (
                          <div className="mt-2 grid gap-1">
                            {risk.associatedControls.map((control) => (
                              <p key={`${risk.id}-${control.id}`} className="text-xs text-[var(--muted)]">
                                {control.referenceId} - {control.name}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-[var(--muted)]">No controls linked.</p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge
                          status={risk.hasAssociatedControls ? "Controls linked" : "No associated controls"}
                          tone={risk.hasAssociatedControls ? "success" : "risk"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-8 text-sm text-[var(--muted)] sm:px-6">
              No imported risks are available for this audit.
            </div>
          )}
        </section>
      ) : null}

      {activeSubtab === "document-review" ? (
        <div className="grid gap-6 2xl:grid-cols-[0.78fr_1.22fr]">
          <section className="flex h-[760px] min-h-0 flex-col overflow-hidden border border-black/5 bg-white shadow-[0_10px_28px_rgba(1,30,65,0.05)]">
            <div className="border-b border-black/5 px-5 py-4 sm:px-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Workflow progression</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">Review stages across active workpapers</h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pr-4 sm:px-6">
              <div className="grid gap-4">
              {workflowStages.map((stage) => {
                const stageItems = workpapers.filter((document) => (document.reviewStatus ?? "NOT_SUBMITTED") === stage);

                return (
                  <div key={stage} className="border border-black/5 bg-[var(--surface-soft)] p-4">
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
                            className="border border-black/10 bg-white px-4 py-3 text-left transition-colors hover:bg-[var(--surface-tint)]"
                          >
                            <p className="text-sm font-semibold text-[var(--foreground)]">{document.displayId ?? document.id} - {document.title}</p>
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
            </div>
          </section>

          <section className="relative flex h-[760px] flex-col overflow-hidden border border-black/5 bg-white shadow-[0_10px_28px_rgba(1,30,65,0.05)]">
            <div className="border-b border-black/5 px-5 py-4 sm:px-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Execution queue</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">Open a fieldwork document and work it directly in the app</h2>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="min-w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-[var(--surface-strong)]">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    <th className="border-b border-black/5 px-4 py-3">Document</th>
                    <th className="border-b border-black/5 px-4 py-3">Owner</th>
                    <th className="border-b border-black/5 px-4 py-3">Due</th>
                    <th className="border-b border-black/5 px-4 py-3">Review stage</th>
                    <th className="border-b border-black/5 px-4 py-3">Linked blockers</th>
                    <th className="border-b border-black/5 px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {fieldworkDocuments.map((document) => {
                    const blockers = linkedSignalsForDocument(document, viewModel.controls, viewModel.questions, viewModel.requests, viewModel.now);
                    const reviewStatus = document.reviewStatus ?? "NOT_SUBMITTED";

                    return (
                      <tr key={document.id} className="border-b border-black/5 transition-colors hover:bg-[var(--surface-soft)]">
                        <td className="px-4 py-4">
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
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => setSelectedId(document.id)}
                            className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand-indigo-core)]"
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

            {selectedDocument?.type === "WORKPAPER" ? (
              <WorkpaperDetailPanel
                auditId={viewModel.auditId}
                authorUserId={getLinkedControlOwnerId(selectedDocument, viewModel.controls)}
                contained
                controls={viewModel.controls}
                document={selectedDocument}
                mode={viewModel.mode}
                now={viewModel.now}
                onClose={() => setSelectedId("")}
                onDocumentUpdated={(nextDocument) => {
                  setDocumentRows((current) => current.map((document) => (document.id === nextDocument.id ? nextDocument : document)));
                }}
                questions={viewModel.questions}
                requests={viewModel.requests}
                users={viewModel.users}
              />
            ) : null}

            {selectedDocument?.type === "EVIDENCE" ? (
              <>
                <button
                  type="button"
                  aria-label="Close evidence detail"
                  onClick={() => setSelectedId("")}
                  className="absolute inset-0 z-30 bg-[rgba(1,30,65,0.18)] backdrop-blur-[1px]"
                />
                <aside className="absolute inset-y-0 right-0 z-40 flex w-full max-w-2xl flex-col overflow-hidden border-l border-black/5 bg-[#fbfaf7] p-6 shadow-[-18px_0_42px_rgba(1,30,65,0.1)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Evidence detail</p>
                      <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">{`${selectedDocument.displayId ?? selectedDocument.id} - ${selectedDocument.title}`}</h2>
                      <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">Evidence remains inspectable here, but workpaper drafting and review are handled directly in the app.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedId("")}
                      className="flex h-10 w-10 items-center justify-center rounded-md border border-black/10 bg-white text-[var(--brand-indigo-core)] transition-colors hover:bg-[var(--surface-tint)]"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-8 min-h-0 flex-1 overflow-y-auto pr-1">
                    <EvidenceInspectPanel document={selectedDocument} linkedBlockers={linkedBlockers} users={viewModel.users} />
                  </div>
                </aside>
              </>
            ) : null}
          </section>
        </div>
      ) : null}

      {activeSubtab === "tollgate-draft" ? (
        <FieldworkTollgateCard
          auditId={viewModel.auditId}
          auditLabel={viewModel.auditLabel}
          descriptionLive="Generate a fieldwork tollgate draft from the current fieldwork record so leadership can review findings support, evidence sufficiency, scope deviations, and readiness to move into reporting."
          descriptionPrototype="Generation is only available for saved live audits because the fieldwork tollgate is built from live fieldwork records."
          emptyPreviewMessage="No fieldwork tollgate has been generated yet. Use the action above to build a draft from the current fieldwork controls, workpapers, evidence, findings, questions, and requests."
          isCollapsed={isTollgateCollapsed}
          onToggleCollapsed={() => setIsTollgateCollapsed((current) => !current)}
        />
      ) : null}

    </div>
  );

  function switchSubtab(nextTab: FieldworkSubtab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("fieldworkTab", nextTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }
}

const fieldworkSubtabs: Array<{ id: FieldworkSubtab; label: string }> = [
  { id: "control-testing", label: "Control Testing" },
  { id: "view-risks", label: "View Risks" },
  { id: "document-review", label: "Document Review" },
  { id: "tollgate-draft", label: "Tollgate Draft" },
];

function getFieldworkSubtab(value: string | null): FieldworkSubtab {
  if (value === "view-risks" || value === "document-review" || value === "tollgate-draft") {
    return value;
  }

  return "control-testing";
}

function FieldworkTollgateCard({
  auditId,
  auditLabel,
  descriptionLive,
  descriptionPrototype,
  emptyPreviewMessage,
  isCollapsed,
  onToggleCollapsed,
}: {
  auditId: string | null;
  auditLabel: string;
  descriptionLive: string;
  descriptionPrototype: string;
  emptyPreviewMessage: string;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const { activeUser } = useActiveUser();
  const { showNotification } = useNotification();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [documentStatus, setDocumentStatus] = useState("");
  const [draftDocumentId, setDraftDocumentId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [missingTokens, setMissingTokens] = useState<string[]>([]);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [ownerRole, setOwnerRole] = useState<string | null>(null);
  const [previewSections, setPreviewSections] = useState<NarrativePreviewSection[]>([]);
  const [previewSummary, setPreviewSummary] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewCommentAuthor, setReviewCommentAuthor] = useState("");
  const [reviewCommentDate, setReviewCommentDate] = useState("");
  const [reviewInput, setReviewInput] = useState("");
  const [reviewStatus, setReviewStatus] = useState<DocumentReviewStatus>("NOT_SUBMITTED");
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(false);

  const isReviewLocked = isReviewStageLocked(reviewStatus);
  const canReset = Boolean(draftTitle || markdown.trim().length > 0 || previewSections.length > 0);
  const canExport = markdown.trim().length > 0;
  const canSave = Boolean(auditId) && !isPending && markdown.trim().length > 0 && !isReviewLocked;
  const hasPersistedDraft = Boolean(draftDocumentId || draftTitle || markdown.trim().length > 0);
  const canSendToReview = Boolean(
    auditId && draftDocumentId && activeUser.role === "AIC" && reviewStatus === "NOT_SUBMITTED" && markdown.trim().length > 0,
  );
  const canRouteToManagerStage = Boolean(draftDocumentId && reviewStatus === "NOT_SUBMITTED" && markdown.trim().length > 0);
  const canApprove =
    (reviewStatus === "MANAGER_REVIEW" && activeUser.role === "MANAGER") ||
    (reviewStatus === "DIRECTOR_REVIEW" && activeUser.role === "DIRECTOR");
  const canSendBack = canApprove;

  const resetDraftState = () => {
    setDocumentStatus("");
    setDraftDocumentId(null);
    setDraftTitle("");
    setGeneratedAt("");
    setMarkdown("");
    setMissingTokens([]);
    setOwnerName(null);
    setOwnerRole(null);
    setPreviewSections([]);
    setPreviewSummary("");
    setReviewComment("");
    setReviewCommentAuthor("");
    setReviewCommentDate("");
    setReviewInput("");
    setReviewStatus("NOT_SUBMITTED");
    setViewMode("preview");
    setIsWorkspaceExpanded(false);
  };

  useEffect(() => {
    if (!auditId) {
      resetDraftState();
      return;
    }

    startTransition(async () => {
      try {
        setError("");
        const response = await fetch(`/api/audits/${auditId}/fieldwork-tollgate`);
        const result = (await response.json()) as FieldworkArtifactDraftResponse & { error?: string };

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to load the fieldwork tollgate draft.");
        }

        if (!result.draft) {
          resetDraftState();
          return;
        }

        applyDraftState(result.draft);
      } catch {
        setError("Unable to load the fieldwork tollgate draft.");
      }
    });
  }, [auditId]);

  function applyDraftState(nextDraft: NonNullable<FieldworkArtifactDraftResponse["draft"]>) {
    setDraftDocumentId(nextDraft.documentId);
    setDraftTitle(nextDraft.title);
    setDocumentStatus(nextDraft.status);
    setGeneratedAt(nextDraft.generatedAt);
    setMarkdown(nextDraft.markdown);
    setMissingTokens(nextDraft.missingRequiredTokens);
    setOwnerName(nextDraft.ownerName);
    setOwnerRole(nextDraft.ownerRole);
    setPreviewSections(nextDraft.previewSections);
    setPreviewSummary(nextDraft.previewSummary);
    setReviewComment(nextDraft.reviewComment ?? "");
    setReviewCommentAuthor(nextDraft.reviewCommentAuthor ?? "");
    setReviewCommentDate(nextDraft.reviewCommentDate ?? "");
    setReviewStatus(normalizeDraftReviewStatus(nextDraft.reviewStatus));
    setReviewInput("");
    setViewMode("preview");
  }

  function exportDraft() {
    try {
      downloadDraftAsWord({
        auditLabel,
        label: "Fieldwork tollgate",
        markdown: sanitizeDraftMarkdown(markdown),
        previewSections,
        previewSummary,
      });
      showNotification({
        title: "Exported",
        message: "Fieldwork tollgate draft exported as a Word document.",
        tone: "success",
      });
    } catch {
      showNotification({
        title: "Export failed",
        message: "There was an error exporting the fieldwork tollgate draft.",
        tone: "error",
      });
    }
  }

  function generateDraft() {
    startTransition(async () => {
      try {
        setError("");
        const response = await fetch(`/api/audits/${auditId}/fieldwork-tollgate`, { method: "POST" });
        const result = (await response.json()) as FieldworkArtifactDraftResponse & { error?: string };

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to generate the fieldwork tollgate.");
        }

        if (!result.draft) {
          throw new Error("Fieldwork tollgate generation returned no draft.");
        }

        applyDraftState(result.draft);
        showNotification({
          title: "Saved successfully",
          message: "Fieldwork tollgate draft generated successfully.",
          tone: "success",
        });
      } catch {
        setError("Unable to generate the fieldwork tollgate.");
        showNotification({
          title: "Save failed",
          message: "There was an error generating the fieldwork tollgate draft.",
          tone: "error",
        });
      }
    });
  }

  function saveDraftEdits() {
    startTransition(async () => {
      try {
        setError("");
        const response = await fetch(`/api/audits/${auditId}/fieldwork-tollgate`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ markdown }),
        });
        const result = (await response.json()) as FieldworkArtifactDraftResponse & { error?: string };

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to save the fieldwork tollgate.");
        }

        if (!result.draft) {
          throw new Error("Fieldwork tollgate save returned no draft.");
        }

        applyDraftState(result.draft);
        showNotification({
          title: "Saved successfully",
          message: "The fieldwork tollgate draft was saved successfully.",
          tone: "success",
        });
      } catch {
        setError("Unable to save the fieldwork tollgate.");
        showNotification({
          title: "Save failed",
          message: "There was an error saving the fieldwork tollgate draft.",
          tone: "error",
        });
      }
    });
  }

  function handleReviewAction(action: "approve" | "send_back" | "submit") {
    startTransition(async () => {
      try {
        setError("");
        const response = await fetch(`/api/audits/${auditId}/fieldwork-tollgate/review`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            actingRole: activeUser.role,
            actingUserName: activeUser.name,
            comment: action === "send_back" ? reviewInput.trim() : undefined,
          }),
        });
        const result = (await response.json()) as FieldworkArtifactReviewResponse & { error?: string };

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to update the fieldwork tollgate review workflow.");
        }

        setDocumentStatus(result.draft.status);
        setGeneratedAt(result.draft.updatedAt);
        setReviewStatus(normalizeDraftReviewStatus(result.draft.reviewStatus));
        setReviewComment(result.draft.reviewComment ?? "");
        setReviewCommentAuthor(result.draft.reviewCommentAuthor ?? "");
        setReviewCommentDate(result.draft.reviewCommentDate ?? "");
        setReviewInput("");
        setViewMode("preview");
        showNotification({
          title: "Workflow updated",
          message: getDraftReviewSuccessMessage("Fieldwork tollgate", action),
          tone: "success",
        });
      } catch {
        setError("Unable to update the fieldwork tollgate review workflow.");
        showNotification({
          title: "Workflow update failed",
          message: "There was an error updating the fieldwork tollgate review workflow.",
          tone: "error",
        });
      }
    });
  }

  return (
    <article className={`border border-black/5 bg-white shadow-[0_10px_28px_rgba(1,30,65,0.05)] ${isCollapsed ? "px-4 py-3" : "p-5"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Fieldwork tollgate</p>
          <h2 className={`font-semibold text-[var(--foreground)] ${isCollapsed ? "mt-1 text-lg leading-6" : "mt-2 text-xl"}`}>Generate fieldwork tollgate draft</h2>
          <p className={isCollapsed ? "mt-1 text-sm leading-6 text-[var(--foreground)]" : "mt-3 text-sm leading-7 text-[var(--foreground)]"}>
            {auditId ? descriptionLive : descriptionPrototype}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-3">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="inline-flex items-center justify-center rounded-md border border-black/10 bg-white p-2 text-[var(--brand-indigo-core)]"
            aria-label={isCollapsed ? "Expand fieldwork tollgate" : "Collapse fieldwork tollgate"}
            aria-expanded={!isCollapsed}
          >
            <ArrowRight size={18} className={`transition-transform duration-200 ${isCollapsed ? "rotate-0" : "rotate-90"}`} />
          </button>
          {!isCollapsed ? (
            <>
              <button
                type="button"
                disabled={!auditId || isPending || isReviewLocked}
                onClick={generateDraft}
                className="inline-flex items-center justify-center rounded-md bg-[var(--brand-indigo-core)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Generating..." : hasPersistedDraft ? "Re-generate fieldwork tollgate" : "Generate tollgate"}
              </button>
              <button
                type="button"
                disabled={!auditId || isPending || !canReset || isReviewLocked}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      setError("");
                      const response = await fetch(`/api/audits/${auditId}/fieldwork-tollgate`, { method: "DELETE" });
                      const result = (await response.json()) as FieldworkArtifactDraftResponse & { error?: string };

                      if (!response.ok) {
                        throw new Error(result.error ?? "Unable to reset the fieldwork tollgate.");
                      }

                      resetDraftState();
                      showNotification({
                        title: "Saved successfully",
                        message: "The fieldwork tollgate draft was reset successfully.",
                        tone: "success",
                      });
                    } catch {
                      setError("Unable to reset the fieldwork tollgate draft.");
                      showNotification({
                        title: "Save failed",
                        message: "There was an error resetting the fieldwork tollgate draft.",
                        tone: "error",
                      });
                    }
                  });
                }}
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
            {generatedAt || draftTitle || documentStatus || ownerName || ownerRole ? (
              <div className="flex flex-wrap items-center gap-2 border border-black/5 bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--muted)]">
                {draftTitle ? <span>Saved draft: {draftTitle}</span> : null}
                {documentStatus ? <span>{documentStatus.replaceAll("_", " ")}</span> : null}
                {ownerName || ownerRole ? <span>Owner: {ownerName ?? "Assigned AIC"}{ownerRole ? ` (${ownerRole})` : ""}</span> : null}
                {generatedAt ? <span>Updated {formatDateTime(generatedAt)}</span> : null}
              </div>
            ) : null}
            {missingTokens.length > 0 ? (
              <div className="border border-[rgba(245,168,0,0.2)] bg-[rgba(245,168,0,0.08)] px-4 py-3 text-sm text-[var(--brand-amber-dark)]">
                Missing required template tokens: {missingTokens.join(", ")}
              </div>
            ) : null}
            {isReviewLocked ? (
              <div className="border border-[rgba(245,168,0,0.2)] bg-[rgba(245,168,0,0.08)] px-4 py-3 text-sm text-[var(--brand-amber-dark)]">
                This draft is locked while it is in review.
              </div>
            ) : null}
            {error ? (
              <div className="border border-[rgba(229,55,107,0.18)] bg-[rgba(229,55,107,0.08)] px-4 py-3 text-sm text-[var(--brand-coral)]">
                {error}
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid gap-5">
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
                    disabled={isReviewLocked}
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
                    onClick={() => setIsWorkspaceExpanded(true)}
                    className="inline-flex items-center justify-center rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[var(--brand-indigo-core)]"
                    aria-label="Expand fieldwork tollgate draft workspace"
                  >
                    <Expand size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={!canExport}
                    onClick={exportDraft}
                    className="inline-flex items-center justify-center rounded-md border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Export Word
                  </button>
                  {viewMode === "edit" ? (
                    <button
                      type="button"
                      disabled={!canSave}
                      onClick={saveDraftEdits}
                      className="inline-flex items-center justify-center rounded-md border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPending ? "Saving..." : "Save edits"}
                    </button>
                  ) : null}
                </div>
              </div>

              <FieldworkDraftWorkspace
                emptyPreviewMessage={emptyPreviewMessage}
                expanded={false}
                markdown={markdown}
                onChangeMarkdown={setMarkdown}
                previewSections={previewSections}
                previewSummary={previewSummary}
                viewMode={viewMode}
              />
            </section>

            {draftDocumentId ? (
              <section className="border border-black/5 bg-[var(--surface-soft)] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Review workflow</p>
                    <p className="mt-2 text-sm text-[var(--foreground)]">
                      The fieldwork tollgate is assigned to the AIC and routed from Fieldwork for manager and director approval.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={reviewStatus.replaceAll("_", " ")} tone={getReviewTone(reviewStatus)} />
                    {ownerRole ? <StatusBadge status={`Owner ${ownerRole}`} tone="neutral" /> : null}
                  </div>
                </div>

                {reviewComment ? (
                  <div className="mt-4 border border-[rgba(245,168,0,0.2)] bg-[rgba(245,168,0,0.08)] px-4 py-3 text-sm text-[var(--brand-amber-dark)]">
                    {reviewComment}
                    {reviewCommentAuthor ? ` | ${reviewCommentAuthor}` : ""}
                    {reviewCommentDate ? ` | ${formatDateTime(reviewCommentDate)}` : ""}
                  </div>
                ) : null}

                {(reviewStatus === "NOT_SUBMITTED" || canSendBack) ? (
                  <textarea
                    value={reviewInput}
                    onChange={(event) => setReviewInput(event.target.value)}
                    rows={3}
                    placeholder={reviewStatus === "NOT_SUBMITTED" ? "Optional routing note for the next reviewer." : "Required reviewer comment for send back."}
                    className="mt-4 w-full resize-y border border-black/10 bg-white px-4 py-3 text-sm leading-6 text-[var(--foreground)] outline-none"
                  />
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {canRouteToManagerStage ? (
                    <button
                      type="button"
                      disabled={isPending || !canSendToReview}
                      onClick={() => handleReviewAction("submit")}
                      className="inline-flex items-center justify-center rounded-md bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPending ? "Working..." : "Send to manager review"}
                    </button>
                  ) : null}
                  {canApprove ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleReviewAction("approve")}
                      className="inline-flex items-center justify-center rounded-md bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPending ? "Working..." : reviewStatus === "MANAGER_REVIEW" ? "Approve to director" : "Approve final"}
                    </button>
                  ) : null}
                  {canSendBack ? (
                    <button
                      type="button"
                      disabled={isPending || reviewInput.trim().length === 0}
                      onClick={() => handleReviewAction("send_back")}
                      className="inline-flex items-center justify-center rounded-md border border-[rgba(229,55,107,0.18)] bg-[rgba(229,55,107,0.08)] px-4 py-2 text-sm font-semibold text-[var(--brand-coral)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPending ? "Working..." : "Send back to AIC"}
                    </button>
                  ) : null}
                </div>
                {canRouteToManagerStage && !canSendToReview ? (
                  <p className="mt-3 text-xs text-[var(--muted)]">
                    Switch the active user to the assigned AIC to route this draft to manager review.
                  </p>
                ) : null}
              </section>
            ) : null}
          </div>

          {isWorkspaceExpanded ? (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(1,30,65,0.32)] p-6 backdrop-blur-[2px]">
              <button
                type="button"
                aria-label="Close expanded tollgate workspace"
                onClick={() => setIsWorkspaceExpanded(false)}
                className="absolute inset-0"
              />
              <section className="relative z-10 flex h-[calc(100dvh-3rem)] w-full max-w-[1200px] flex-col border border-black/10 bg-[var(--surface-soft)] shadow-[0_28px_72px_rgba(1,30,65,0.2)]">
                <div className="flex items-start justify-between gap-4 border-b border-black/5 bg-white px-5 py-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Expanded workspace</p>
                    <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">Fieldwork tollgate draft</h3>
                  </div>
                  <div className="flex items-center gap-2">
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
                      disabled={isReviewLocked}
                      onClick={() => setViewMode("edit")}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        viewMode === "edit" ? "bg-[var(--brand-indigo-core)] text-white" : "border border-black/10 bg-white text-[var(--muted)]"
                      }`}
                    >
                      Editable draft
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsWorkspaceExpanded(false)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-black/10 bg-white text-[var(--brand-indigo-core)]"
                      aria-label="Close expanded tollgate workspace"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-black/5 bg-white px-5 py-3">
                  <div className="text-sm text-[var(--muted)]">
                    {draftTitle ? `Saved draft: ${draftTitle}` : "Unsaved draft workspace"}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!canExport}
                      onClick={exportDraft}
                      className="inline-flex items-center justify-center rounded-md border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Export Word
                    </button>
                    {viewMode === "edit" ? (
                      <button
                        type="button"
                        disabled={!canSave}
                        onClick={saveDraftEdits}
                        className="inline-flex items-center justify-center rounded-md border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isPending ? "Saving..." : "Save edits"}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden px-5 py-5">
                  <FieldworkDraftWorkspace
                    emptyPreviewMessage={emptyPreviewMessage}
                    expanded
                    markdown={markdown}
                    onChangeMarkdown={setMarkdown}
                    previewSections={previewSections}
                    previewSummary={previewSummary}
                    viewMode={viewMode}
                  />
                </div>
              </section>
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  );
}

function FieldworkDraftWorkspace({
  emptyPreviewMessage,
  expanded,
  markdown,
  onChangeMarkdown,
  previewSections,
  previewSummary,
  viewMode,
}: {
  emptyPreviewMessage: string;
  expanded: boolean;
  markdown: string;
  onChangeMarkdown: (value: string) => void;
  previewSections: NarrativePreviewSection[];
  previewSummary: string;
  viewMode: "preview" | "edit";
}) {
  if (viewMode === "edit") {
    return (
      <textarea
        value={markdown}
        onChange={(event) => onChangeMarkdown(event.target.value)}
        rows={expanded ? 28 : 18}
        placeholder="Generate a draft, then edit it here."
        className={cn(
          "mt-4 w-full border border-black/10 bg-white px-4 py-4 font-mono text-sm leading-7 text-[var(--foreground)] outline-none",
          expanded ? "h-full min-h-0 resize-none" : "resize-y",
        )}
      />
    );
  }

  if (previewSections.length > 0) {
    return (
      <div className={cn("mt-4", expanded ? "h-full overflow-auto pr-1" : "max-h-[520px] overflow-auto")}>
        {previewSummary ? (
          <div className="border border-black/5 bg-white px-4 py-4 text-sm leading-7 text-[var(--foreground)]">
            {previewSummary}
          </div>
        ) : null}
        <div className="mt-4 grid gap-4">
          {previewSections.map((section, sectionIndex) => (
            <div key={`${section.heading}-${sectionIndex}`} className="border border-black/5 bg-white px-4 py-4">
              <h3 className="text-base font-semibold text-[var(--foreground)]">{section.heading}</h3>
              <div className="mt-3 grid gap-3">
                {section.body.map((entry, entryIndex) =>
                  entry.startsWith("- ") ? (
                    <div key={`${section.heading}-${sectionIndex}-${entryIndex}`} className="flex gap-2 text-sm leading-7 text-[var(--foreground)]">
                      <span className="pt-[0.35rem] text-[var(--muted)]">&bull;</span>
                      <span>{entry.slice(2)}</span>
                    </div>
                  ) : (
                    <p key={`${section.heading}-${sectionIndex}-${entryIndex}`} className="text-sm leading-7 text-[var(--foreground)]">
                      {entry}
                    </p>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{emptyPreviewMessage}</p>;
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
    <article className="border border-black/5 bg-white p-5 shadow-[0_8px_24px_rgba(1,30,65,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
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
                  <p className="text-sm font-semibold text-[var(--foreground)]">{item.id} - {item.title}</p>
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

function getLinkedControlOwnerId(document: AuditDocument, controls: Control[]) {
  if (!document.linkedControlId) {
    return undefined;
  }

  return controls.find((control) => control.id === document.linkedControlId)?.ownerId ?? undefined;
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

function normalizeDraftReviewStatus(status?: string | null): DocumentReviewStatus {
  if (
    status === "NOT_SUBMITTED" ||
    status === "AIC_REVIEW" ||
    status === "MANAGER_REVIEW" ||
    status === "DIRECTOR_REVIEW" ||
    status === "APPROVED"
  ) {
    return status;
  }

  return "NOT_SUBMITTED";
}

function getDraftReviewSuccessMessage(label: string, action: "approve" | "send_back" | "submit") {
  if (action === "submit") {
    return `${label} was routed to manager review.`;
  }

  if (action === "send_back") {
    return `${label} was sent back to the AIC.`;
  }

  return `${label} advanced to the next review step.`;
}

function isReviewStageLocked(status: DocumentReviewStatus) {
  return status === "AIC_REVIEW" || status === "MANAGER_REVIEW" || status === "DIRECTOR_REVIEW";
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
