"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowRight, Bot, ChevronDown, Copy, FileText, Layers3, ShieldAlert, X } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { useActiveUser } from "@/components/layout/active-user-context";
import { PhaseCompletionCard } from "@/components/phase-three/phase-completion-card";
import { useNotification } from "@/components/ui/notification-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import { sanitizeDraftMarkdown } from "@/lib/planning-narrative/format";
import { formatDateTime } from "@/lib/utils";
import type { AuditPhase, DocumentReviewStatus, PlanningSourceSet, RCSARecord } from "@/types/audit";

type SourceFilter = PlanningSourceSet["sourceType"] | "ALL";
type NarrativePreviewSection = {
  body: string[];
  heading: string;
};

type PlanningArtifactDraftResponse = {
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

type PlanningArtifactReviewResponse = {
  draft: {
    reviewComment: string | null;
    reviewCommentAuthor: string | null;
    reviewCommentDate: string | null;
    reviewStatus: string;
    status: string;
    updatedAt: string;
  };
};

const sourceFilterOptions: SourceFilter[] = [
  "ALL",
  "THIRD_PARTY",
  "APPLICATION",
  "OUTSTANDING_ISSUE",
  "RCSA",
  "CONTINUOUS_MONITORING",
  "PRIOR_FINDING",
  "REGULATORY_UPDATE",
  "NEWS",
];

const FADE_IN_DELAY_MS = 120;

export function PlanningView({
  auditId = null,
  auditLabel = "Prototype Demo Audit",
  auditPeriodLabel = "Static sample data",
  auditStatus = "prototype",
  currentPhase = "Planning",
  planningSources,
  rcsaRecords,
}: {
  auditId?: string | null;
  auditLabel?: string;
  auditPeriodLabel?: string;
  auditStatus?: string;
  currentPhase?: AuditPhase;
  planningSources: PlanningSourceSet[];
  rcsaRecords: RCSARecord[];
}) {
  const [selectedSourceType, setSelectedSourceType] = useState<SourceFilter>("ALL");
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [promptViewMode, setPromptViewMode] = useState<"prompt" | "json">("prompt");
  const [isSuggestionVisible, setIsSuggestionVisible] = useState(false);
  const [isNarrativeCollapsed, setIsNarrativeCollapsed] = useState(true);
  const [isTollgateCollapsed, setIsTollgateCollapsed] = useState(true);
  const isLiveAudit = Boolean(auditId);
  const { showNotification } = useNotification();

  const filteredSources = useMemo(() => {
    return planningSources.filter((source) => selectedSourceType === "ALL" || source.sourceType === selectedSourceType);
  }, [planningSources, selectedSourceType]);
  const selectedSource = planningSources.find((source) => source.id === selectedSourceId) ?? null;
  const promptPackage = useMemo(
    () => buildScopePromptPackage({ auditLabel, currentPhase, planningSources, rcsaRecords }),
    [auditLabel, currentPhase, planningSources, rcsaRecords],
  );
  const highRiskCount = rcsaRecords.filter((record) => record.residualRiskRating === "HIGH").length;
  const currentSignals = planningSources.filter((source) =>
    ["OUTSTANDING_ISSUE", "CONTINUOUS_MONITORING", "PRIOR_FINDING", "REGULATORY_UPDATE", "NEWS"].includes(source.sourceType),
  ).length;

  useEffect(() => {
    setIsSuggestionVisible(false);

    const timer = window.setTimeout(() => {
      setIsSuggestionVisible(true);
    }, FADE_IN_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-0 flex-col gap-4 xl:h-[calc(100dvh-13rem)]">
      <PageHeader
        title="Planning"
        description={
          isLiveAudit
            ? "Planning consolidates imported source intelligence, RCSA grounding, live scope signals, and the draft outputs needed to move into controlled fieldwork."
            : "Planning consolidates source intelligence, RCSA grounding, scope recommendations, and the draft outputs needed to move into controlled fieldwork."
        }
        phaseStatus={{ label: currentPhase === "Planning" ? "Active" : `Current phase: ${currentPhase}`, active: currentPhase === "Planning" }}
      />

      <div>
        <PhaseCompletionCard auditId={auditId} auditLabel={auditLabel} auditStatus={auditStatus} currentPhase={currentPhase} pagePhase="Planning" />
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PlanningMetric
          icon={<Layers3 size={18} />}
          label="Source inputs"
          value={`${planningSources.length}`}
          detail="Third parties, applications, issues, monitoring, and external signals"
          tone="neutral"
        />
        <PlanningMetric
          icon={<ShieldAlert size={18} />}
          label="High-risk RCSAs"
          value={`${highRiskCount}`}
          detail="Residual risk areas shaping scope depth"
          tone="risk"
        />
        <PlanningMetric
          icon={<Bot size={18} />}
          label="Scope signals"
          value={`${currentSignals}`}
          detail="Current-state indicators feeding the planning scope analysis panel"
          tone="warning"
        />
        <PlanningMetric
          icon={<FileText size={18} />}
          label="Draft outputs"
          value="2"
          detail="Narrative and tollgate materials are staged below"
          tone="success"
        />
      </section>

      <div className="mt-6 grid gap-6 2xl:grid-cols-[1.25fr_0.75fr]">
        <section className="grid content-start gap-3 self-start">
          <section className="relative flex h-[760px] flex-col overflow-hidden rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Planning inputs</p>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">Source input inventory</h2>
              </div>

              <select
                value={selectedSourceType}
                onChange={(event) => setSelectedSourceType(event.target.value as SourceFilter)}
                className="rounded-full border border-black/5 bg-[var(--surface-tint)] px-4 py-2 text-sm text-[var(--foreground)] outline-none"
              >
                {sourceFilterOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "ALL" ? "All source types" : option.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 min-h-0 flex-1 overflow-auto">
              <table className="min-w-full border-separate border-spacing-y-3">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    <th className="px-4">Input</th>
                    <th className="px-4">Source type</th>
                    <th className="px-4">Document/data</th>
                    <th className="px-4">Owner</th>
                    <th className="px-4">Refresh</th>
                    <th className="px-4">Updated</th>
                    <th className="px-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSources.length > 0 ? (
                    filteredSources.map((source) => (
                      <tr key={source.id} className="bg-[#fcfbf8] shadow-[0_12px_34px_rgba(1,30,65,0.06)]">
                        <td className="rounded-l-3xl px-4 py-4">
                          <p className="text-sm font-semibold text-[var(--foreground)]">{source.title}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">{source.summary}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">{source.sourceSystem}</p>
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={source.sourceType} tone={getSourceTone(source.sourceType)} />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-2">
                            <StatusBadge status={source.dataKind} tone="neutral" />
                            <p className="text-sm text-[var(--muted)]">{source.artifactName}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-[var(--muted)]">{source.owner}</td>
                        <td className="px-4 py-4 text-sm text-[var(--muted)]">{formatCadence(source.refreshCadence)}</td>
                        <td className="px-4 py-4 text-sm text-[var(--muted)]">{formatDateTime(source.lastUpdated)}</td>
                        <td className="rounded-r-3xl px-4 py-4">
                          <button
                            type="button"
                            onClick={() => setSelectedSourceId(source.id)}
                            className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand-indigo-core)]"
                          >
                            View input
                            <ArrowRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="bg-[#fcfbf8] shadow-[0_12px_34px_rgba(1,30,65,0.06)]">
                      <td colSpan={7} className="rounded-3xl px-4 py-6 text-sm text-[var(--muted)]">
                        No planning source inputs are loaded for the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedSource ? (
              <>
                <button
                  type="button"
                  aria-label="Close planning input detail"
                  onClick={() => setSelectedSourceId("")}
                  className="absolute inset-0 z-10 bg-[rgba(1,30,65,0.18)] backdrop-blur-[1px]"
                />
                <aside className="absolute inset-y-0 right-0 z-20 flex w-full max-w-xl flex-col border-l border-black/5 bg-[#fbfaf7] p-6 shadow-[-24px_0_60px_rgba(1,30,65,0.12)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Planning input detail</p>
                      <h3 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">{`${selectedSource.id} · ${selectedSource.title}`}</h3>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        Planning input detail shows what the source actually contains and how the team intends to use it in scope formation.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedSourceId("")}
                      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/5 bg-white text-[var(--brand-indigo-core)] transition-colors hover:bg-[var(--surface-tint)]"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
                    <div className="grid gap-6">
                      <section className="grid gap-4 md:grid-cols-2">
                        <InputInfoCard label="Source type" value={selectedSource.sourceType.replaceAll("_", " ")} />
                        <InputInfoCard label="Document/data kind" value={selectedSource.dataKind.replaceAll("_", " ")} />
                        <InputInfoCard label="Artifact name" value={selectedSource.artifactName} />
                        <InputInfoCard label="Owner" value={selectedSource.owner} />
                        <InputInfoCard label="Refresh cadence" value={formatCadence(selectedSource.refreshCadence)} />
                        <InputInfoCard label="Last updated" value={formatDateTime(selectedSource.lastUpdated)} />
                      </section>

                      <section className="rounded-[24px] border border-black/5 bg-white p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Planning use</p>
                        <p className="mt-4 text-sm leading-7 text-[var(--foreground)]">{selectedSource.planningUse}</p>
                      </section>

                      <section className="rounded-[24px] border border-black/5 bg-white p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Key fields expected in the input</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {selectedSource.keyFields.map((field) => (
                            <StatusBadge key={field} status={field} tone="neutral" />
                          ))}
                        </div>
                      </section>

                      <section className="rounded-[24px] border border-black/5 bg-white p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                          {isLiveAudit ? "Loaded input details" : "Generated sample input content"}
                        </p>
                        <div className="mt-4 grid gap-3">
                          {selectedSource.sampleDetails.map((detail) => (
                            <div key={detail} className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3 text-sm text-[var(--muted)]">
                              {detail}
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>
                  </div>
                </aside>
              </>
            ) : null}
          </section>

          <PlanningArtifactCard
            auditId={auditId}
            auditLabel={auditLabel}
            descriptionLive="Generate a planning narrative for the current live planning data so the audit team has a working document that captures process understanding, risks, controls, and preliminary scope rationale."
            descriptionPrototype="Generation is only available for saved live audits because the narrative is built from imported audit records."
            emptyPreviewMessage="No narrative has been generated yet. Use the action above to build a draft from the current audit record, imported planning inputs, issues, RCSA data, monitoring results, prior findings, and planning setup fields."
            endpointPath="planning-narrative"
            generateActionLabel="Generate narrative"
            isCollapsed={isNarrativeCollapsed}
            label="Planning narrative"
            resetSuccessMessage="The planning narrative draft was reset successfully."
            saveSuccessMessage="The planning narrative draft was saved successfully."
            title="Generate planning narrative draft"
            onToggleCollapsed={() => setIsNarrativeCollapsed((current) => !current)}
          />

          <PlanningArtifactCard
            auditId={auditId}
            auditLabel={auditLabel}
            descriptionLive="Generate a planning tollgate draft using the current live planning inputs so leadership can review the proposed scope, audit approach, resources, timing, and fieldwork entry posture."
            descriptionPrototype="Generation is only available for saved live audits because the tollgate is built from imported planning records."
            emptyPreviewMessage="No planning tollgate has been generated yet. Use the action above to build a leadership-ready draft from the current planning record."
            endpointPath="planning-tollgate"
            generateActionLabel="Generate tollgate"
          isCollapsed={isTollgateCollapsed}
            label="Planning tollgate"
            resetSuccessMessage="The planning tollgate draft was reset successfully."
            saveSuccessMessage="The planning tollgate draft was saved successfully."
            title="Generate planning tollgate draft"
          onToggleCollapsed={() => setIsTollgateCollapsed((current) => !current)}
          />
        </section>

        <section className="grid gap-6">
          <article className="rounded-[28px] border border-black/5 bg-[var(--surface-tint)] p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(1,30,65,0.08)] text-[var(--brand-indigo-core)]">
                  <Bot size={20} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                    {isLiveAudit ? "Live AI scope prompt" : "AI scope prompt"}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">Generate a scope recommendation prompt</h3>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(245,168,0,0.18)] bg-[rgba(245,168,0,0.08)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-amber-dark)]">
                <Bot size={14} />
                {isLiveAudit ? "Prompt generator" : "AI handoff"}
              </div>
            </div>

            <div
              className={`mt-5 grid gap-3 transition-all duration-500 ${
                isSuggestionVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
              }`}
            >
              <div className="rounded-[20px] bg-white px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">Paste this into Copilot, ChatGPT, Claude, or a similar tool</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      This prompt asks the external AI to recommend audit scope using only the loaded planning inputs and to justify every recommendation with inline quoted citations.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyText(promptPackage.prompt, "Prompt copied to clipboard.")}
                      className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand-indigo-core)]"
                    >
                      <Copy size={14} />
                      Copy prompt
                    </button>
                    <button
                      type="button"
                      onClick={() => copyText(promptPackage.json, "JSON companion copied to clipboard.")}
                      className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand-indigo-core)]"
                    >
                      <Copy size={14} />
                      Copy JSON
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <PromptMetaCard label="Planning sources" value={`${promptPackage.metadata.planningSourceCount}`} />
                  <PromptMetaCard label="RCSA records" value={`${promptPackage.metadata.rcsaCount}`} />
                  <PromptMetaCard label="Citation excerpts" value={`${promptPackage.metadata.citationCount}`} />
                </div>

                <div className="mt-4 rounded-[18px] bg-[var(--surface-tint)] px-4 py-3 text-sm text-[var(--muted)]">
                  Generated {formatDateTime(promptPackage.metadata.generatedAt)}. Switch between the prompt and JSON companion below before handing the package to the external AI tool.
                </div>

                <section className="mt-4 rounded-[18px] border border-black/5 bg-[#fcfbf8] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPromptViewMode("prompt")}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                          promptViewMode === "prompt" ? "bg-[var(--brand-indigo-core)] text-white" : "border border-black/10 bg-white text-[var(--muted)]"
                        }`}
                      >
                        Prompt
                      </button>
                      <button
                        type="button"
                        onClick={() => setPromptViewMode("json")}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                          promptViewMode === "json" ? "bg-[var(--brand-indigo-core)] text-white" : "border border-black/10 bg-white text-[var(--muted)]"
                        }`}
                      >
                        JSON companion
                      </button>
                    </div>
                    <StatusBadge status="LLM-ready" tone="warning" />
                  </div>
                  {promptViewMode === "prompt" ? (
                    <textarea
                      readOnly
                      value={promptPackage.prompt}
                      rows={20}
                      className="mt-3 w-full resize-y rounded-[16px] border border-black/5 bg-white px-4 py-4 font-mono text-sm leading-6 text-[var(--foreground)] outline-none"
                    />
                  ) : (
                    <textarea
                      readOnly
                      value={promptPackage.json}
                      rows={18}
                      className="mt-3 w-full resize-y rounded-[16px] border border-black/5 bg-white px-4 py-4 font-mono text-sm leading-6 text-[var(--foreground)] outline-none"
                    />
                  )}
                </section>
              </div>
            </div>
          </article>

        </section>
      </div>

    </div>
  );

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      showNotification({
        title: "Copied",
        message: successMessage,
        tone: "success",
      });
    } catch {
      showNotification({
        title: "Copy failed",
        message: "Unable to copy to the clipboard from this browser session.",
        tone: "error",
      });
    }
  }
}

function PlanningArtifactCard({
  auditId,
  auditLabel,
  descriptionLive,
  descriptionPrototype,
  emptyPreviewMessage,
  endpointPath,
  generateActionLabel,
  isCollapsed,
  label,
  resetSuccessMessage,
  saveSuccessMessage,
  title,
  onToggleCollapsed,
}: {
  auditId: string | null;
  auditLabel: string;
  descriptionLive: string;
  descriptionPrototype: string;
  emptyPreviewMessage: string;
  endpointPath: "planning-narrative" | "planning-tollgate";
  generateActionLabel: string;
  isCollapsed: boolean;
  label: string;
  resetSuccessMessage: string;
  saveSuccessMessage: string;
  title: string;
  onToggleCollapsed: () => void;
}) {
  const { activeUser } = useActiveUser();
  const [isPending, startTransition] = useTransition();
  const { showNotification } = useNotification();
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

  const isReviewLocked = isPlanningDraftLockedForReview(reviewStatus);
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
  };

  useEffect(() => {
    if (!auditId) {
      resetDraftState();
      return;
    }

    startTransition(async () => {
      try {
        setError("");
        const response = await fetch(`/api/audits/${auditId}/${endpointPath}`);
        const result = (await response.json()) as PlanningArtifactDraftResponse & { error?: string };

        if (!response.ok) {
          throw new Error(result.error ?? `Unable to load the ${label.toLowerCase()} draft.`);
        }

        if (!result.draft) {
          resetDraftState();
          return;
        }

        applyDraftState(result.draft);
      } catch {
        setError(`Unable to load the ${label.toLowerCase()} draft.`);
      }
    });
  }, [auditId, endpointPath, label]);

  function applyDraftState(nextDraft: NonNullable<PlanningArtifactDraftResponse["draft"]>) {
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
    setReviewStatus(normalizePlanningReviewStatus(nextDraft.reviewStatus));
    setReviewInput("");
    setViewMode("preview");
  }

  function exportDraft() {
    try {
      downloadPlanningDraftAsWord({
        auditLabel,
        label,
        markdown: sanitizeDraftMarkdown(markdown),
        previewSections,
        previewSummary,
      });
      showNotification({
        title: "Exported",
        message: `${label} draft exported as a Word document.`,
        tone: "success",
      });
    } catch {
      showNotification({
        title: "Export failed",
        message: `There was an error exporting the ${label.toLowerCase()} draft.`,
        tone: "error",
      });
    }
  }

  function generateDraft() {
    startTransition(async () => {
      try {
        setError("");
        const response = await fetch(`/api/audits/${auditId}/${endpointPath}`, {
          method: "POST",
        });
        const result = (await response.json()) as PlanningArtifactDraftResponse & { error?: string };

        if (!response.ok) {
          throw new Error(result.error ?? `Unable to generate the ${label.toLowerCase()}.`);
        }

        if (!result.draft) {
          throw new Error(`${label} generation returned no draft.`);
        }

        applyDraftState(result.draft);
        showNotification({
          title: "Saved successfully",
          message: `${label} draft generated successfully.`,
          tone: "success",
        });
      } catch {
        setError(`Unable to generate the ${label.toLowerCase()}.`);
        showNotification({
          title: "Save failed",
          message: `There was an error generating the ${label.toLowerCase()} draft.`,
          tone: "error",
        });
      }
    });
  }

  function saveDraftEdits() {
    startTransition(async () => {
      try {
        setError("");
        const response = await fetch(`/api/audits/${auditId}/${endpointPath}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ markdown }),
        });
        const result = (await response.json()) as PlanningArtifactDraftResponse & { error?: string };

        if (!response.ok) {
          throw new Error(result.error ?? `Unable to save the ${label.toLowerCase()}.`);
        }

        if (!result.draft) {
          throw new Error(`${label} save returned no draft.`);
        }

        applyDraftState(result.draft);
        showNotification({
          title: "Saved successfully",
          message: saveSuccessMessage,
          tone: "success",
        });
      } catch {
        setError(`Unable to save the ${label.toLowerCase()}.`);
        showNotification({
          title: "Save failed",
          message: `There was an error saving the ${label.toLowerCase()} draft.`,
          tone: "error",
        });
      }
    });
  }

  function handleReviewAction(action: "approve" | "send_back" | "submit") {
    startTransition(async () => {
      try {
        setError("");
        const response = await fetch(`/api/audits/${auditId}/${endpointPath}/review`, {
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
        const result = (await response.json()) as PlanningArtifactReviewResponse & { error?: string };

        if (!response.ok) {
          throw new Error(result.error ?? `Unable to update the ${label.toLowerCase()} review workflow.`);
        }

        setDocumentStatus(result.draft.status);
        setGeneratedAt(result.draft.updatedAt);
        setReviewStatus(normalizePlanningReviewStatus(result.draft.reviewStatus));
        setReviewComment(result.draft.reviewComment ?? "");
        setReviewCommentAuthor(result.draft.reviewCommentAuthor ?? "");
        setReviewCommentDate(result.draft.reviewCommentDate ?? "");
        setReviewInput("");
        setViewMode("preview");
        showNotification({
          title: "Workflow updated",
          message: getPlanningReviewSuccessMessage(label, action),
          tone: "success",
        });
      } catch {
        setError(`Unable to update the ${label.toLowerCase()} review workflow.`);
        showNotification({
          title: "Workflow update failed",
          message: `There was an error updating the ${label.toLowerCase()} review workflow.`,
          tone: "error",
        });
      }
    });
  }

  return (
    <article className={`rounded-[28px] border border-black/5 bg-white shadow-[0_18px_50px_rgba(1,30,65,0.08)] ${isCollapsed ? "px-4 py-3" : "p-6"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{label}</p>
          <h2 className={`font-semibold text-[var(--foreground)] ${isCollapsed ? "mt-1 text-lg leading-6" : "mt-3 text-2xl"}`}>{title}</h2>
          <p className={isCollapsed ? "mt-1 text-sm leading-6 text-[var(--foreground)]" : "mt-3 text-sm leading-7 text-[var(--foreground)]"}>
            {auditId ? descriptionLive : descriptionPrototype}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-3">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white p-2 text-[var(--brand-indigo-core)]"
            aria-label={isCollapsed ? `Expand ${label}` : `Collapse ${label}`}
            aria-expanded={!isCollapsed}
          >
            <ChevronDown size={18} className={`transition-transform duration-200 ${isCollapsed ? "-rotate-90" : "rotate-0"}`} />
          </button>
          {!isCollapsed ? (
            <>
              <button
                type="button"
                disabled={!auditId || isPending || isReviewLocked}
                onClick={generateDraft}
                className="inline-flex items-center justify-center rounded-full bg-[var(--brand-indigo-core)] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Generating..." : hasPersistedDraft ? `Re-generate ${label.toLowerCase()}` : generateActionLabel}
              </button>
              <button
                type="button"
                disabled={!auditId || isPending || !canReset || isReviewLocked}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      setError("");
                      const response = await fetch(`/api/audits/${auditId}/${endpointPath}`, {
                        method: "DELETE",
                      });
                      const result = (await response.json()) as PlanningArtifactDraftResponse & { error?: string };

                      if (!response.ok) {
                        throw new Error(result.error ?? `Unable to reset the ${label.toLowerCase()}.`);
                      }

                      resetDraftState();
                      showNotification({
                        title: "Saved successfully",
                        message: resetSuccessMessage,
                        tone: "success",
                      });
                    } catch {
                      setError(`Unable to reset the ${label.toLowerCase()} draft.`);
                      showNotification({
                        title: "Save failed",
                        message: `There was an error resetting the ${label.toLowerCase()} draft.`,
                        tone: "error",
                      });
                    }
                  });
                }}
                className="inline-flex items-center justify-center rounded-full border border-[rgba(229,55,107,0.18)] bg-[rgba(229,55,107,0.08)] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-coral)] disabled:cursor-not-allowed disabled:opacity-60"
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
              <div className="flex flex-wrap items-center gap-2 rounded-[18px] bg-[var(--surface-tint)] px-4 py-3 text-sm text-[var(--muted)]">
                {draftTitle ? <span>Saved draft: {draftTitle}</span> : null}
                {documentStatus ? <span>{documentStatus.replaceAll("_", " ")}</span> : null}
                {ownerName || ownerRole ? <span>Owner: {ownerName ?? "Assigned AIC"}{ownerRole ? ` (${ownerRole})` : ""}</span> : null}
                {generatedAt ? <span>Updated {formatDateTime(generatedAt)}</span> : null}
              </div>
            ) : null}
            {missingTokens.length > 0 ? (
              <div className="rounded-[18px] border border-[rgba(245,168,0,0.2)] bg-[rgba(245,168,0,0.08)] px-4 py-3 text-sm text-[var(--brand-amber-dark)]">
                Missing required template tokens: {missingTokens.join(", ")}
              </div>
            ) : null}
            {isReviewLocked ? (
              <div className="rounded-[18px] border border-[rgba(245,168,0,0.2)] bg-[rgba(245,168,0,0.08)] px-4 py-3 text-sm text-[var(--brand-amber-dark)]">
                This draft is locked while it is in review.
              </div>
            ) : null}
            {error ? (
              <div className="rounded-[18px] border border-[rgba(229,55,107,0.18)] bg-[rgba(229,55,107,0.08)] px-4 py-3 text-sm text-[var(--brand-coral)]">
                {error}
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid gap-5">
            <section className="rounded-[20px] border border-black/5 bg-[#fcfbf8] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="mr-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Draft workspace</p>
                  <button
                    type="button"
                    onClick={() => setViewMode("preview")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      viewMode === "preview" ? "bg-[var(--brand-indigo-core)] text-white" : "border border-black/10 bg-white text-[var(--muted)]"
                    }`}
                  >
                    Formatted preview
                  </button>
                  <button
                    type="button"
                    disabled={isReviewLocked}
                    onClick={() => setViewMode("edit")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      viewMode === "edit" ? "bg-[var(--brand-indigo-core)] text-white" : "border border-black/10 bg-white text-[var(--muted)]"
                    }`}
                  >
                    Editable draft
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!canExport}
                    onClick={exportDraft}
                    className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Export Word
                  </button>
                  {viewMode === "edit" ? (
                    <button
                      type="button"
                      disabled={!canSave}
                      onClick={saveDraftEdits}
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
                  onChange={(event) => setMarkdown(event.target.value)}
                  rows={18}
                  placeholder="Generate a draft, then edit it here."
                  className="mt-4 w-full resize-y rounded-[18px] border border-black/5 bg-white px-4 py-4 font-mono text-sm leading-7 text-[var(--foreground)] outline-none"
                />
              ) : previewSections.length > 0 ? (
                <div className="mt-4 max-h-[520px] overflow-auto">
                  {previewSummary ? (
                    <div className="rounded-[18px] bg-white px-4 py-4 text-sm leading-7 text-[var(--foreground)]">
                      {previewSummary}
                    </div>
                  ) : null}
                  <div className="mt-4 grid gap-4">
                    {previewSections.map((section, sectionIndex) => (
                      <div key={`${section.heading}-${sectionIndex}`} className="rounded-[18px] bg-white px-4 py-4">
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
              ) : (
                <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{emptyPreviewMessage}</p>
              )}
            </section>

            {draftDocumentId ? (
              <section className="rounded-[20px] border border-black/5 bg-[#fcfbf8] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Review workflow</p>
                    <p className="mt-2 text-sm text-[var(--foreground)]">
                      The {label.toLowerCase()} is assigned to the AIC and routed from Planning for manager and director approval.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={reviewStatus.replaceAll("_", " ")} tone={getPlanningReviewTone(reviewStatus)} />
                    {ownerRole ? <StatusBadge status={`Owner ${ownerRole}`} tone="neutral" /> : null}
                  </div>
                </div>

                {reviewComment ? (
                  <div className="mt-4 rounded-[18px] border border-[rgba(245,168,0,0.2)] bg-[rgba(245,168,0,0.08)] px-4 py-3 text-sm text-[var(--brand-amber-dark)]">
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
                    className="mt-4 w-full resize-y rounded-[18px] border border-black/5 bg-white px-4 py-3 text-sm leading-6 text-[var(--foreground)] outline-none"
                  />
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {canRouteToManagerStage ? (
                    <button
                      type="button"
                      disabled={isPending || !canSendToReview}
                      onClick={() => handleReviewAction("submit")}
                      className="inline-flex items-center justify-center rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPending ? "Working..." : "Send to manager review"}
                    </button>
                  ) : null}
                  {canApprove ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleReviewAction("approve")}
                      className="inline-flex items-center justify-center rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPending ? "Working..." : reviewStatus === "MANAGER_REVIEW" ? "Approve to director" : "Approve final"}
                    </button>
                  ) : null}
                  {canSendBack ? (
                    <button
                      type="button"
                      disabled={isPending || reviewInput.trim().length === 0}
                      onClick={() => handleReviewAction("send_back")}
                      className="inline-flex items-center justify-center rounded-full border border-[rgba(229,55,107,0.18)] bg-[rgba(229,55,107,0.08)] px-4 py-2 text-sm font-semibold text-[var(--brand-coral)] disabled:cursor-not-allowed disabled:opacity-60"
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
        </>
      ) : null}
    </article>
  );
}

function normalizePlanningReviewStatus(status?: string | null): DocumentReviewStatus {
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

function getPlanningReviewSuccessMessage(label: string, action: "approve" | "send_back" | "submit") {
  if (action === "submit") {
    return `${label} was routed to manager review.`;
  }

  if (action === "send_back") {
    return `${label} was sent back to the AIC.`;
  }

  return `${label} advanced to the next review step.`;
}

function getPlanningReviewTone(status: DocumentReviewStatus): "neutral" | "warning" | "risk" | "success" {
  if (status === "APPROVED") {
    return "success";
  }

  if (status === "MANAGER_REVIEW" || status === "DIRECTOR_REVIEW" || status === "AIC_REVIEW") {
    return "warning";
  }

  return "neutral";
}

function isPlanningDraftLockedForReview(status: DocumentReviewStatus) {
  return status === "AIC_REVIEW" || status === "MANAGER_REVIEW" || status === "DIRECTOR_REVIEW";
}

function PlanningMetric({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "warning" | "risk" | "success";
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

function InputInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-black/5 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function PromptMetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="mt-1.5 text-sm font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function downloadPlanningDraftAsWord({
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

function getSourceTone(sourceType: PlanningSourceSet["sourceType"]) {
  if (sourceType === "OUTSTANDING_ISSUE" || sourceType === "PRIOR_FINDING" || sourceType === "NEWS") {
    return "risk";
  }

  if (sourceType === "CONTINUOUS_MONITORING" || sourceType === "REGULATORY_UPDATE") {
    return "warning";
  }

  return "neutral";
}

function buildScopePromptPackage({
  auditLabel,
  currentPhase,
  planningSources,
  rcsaRecords,
}: {
  auditLabel: string;
  currentPhase: AuditPhase;
  planningSources: PlanningSourceSet[];
  rcsaRecords: RCSARecord[];
}) {
  const normalizedSources = planningSources.map((source) => ({
    artifactLabel: source.artifactName,
    citationId: source.id,
    dataKind: source.dataKind,
    evidence: [source.summary, source.planningUse, ...source.sampleDetails]
      .filter((value, index, values) => value.trim().length > 0 && values.indexOf(value) === index)
      .slice(0, 4),
    keyFields: source.keyFields,
    lastUpdated: source.lastUpdated,
    owner: source.owner,
    refreshCadence: source.refreshCadence,
    sourceSystem: source.sourceSystem,
    sourceType: source.sourceType,
    title: source.title,
  }));
  const normalizedRcsa = rcsaRecords.map((record) => ({
    businessUnit: record.businessUnit,
    citationId: record.id,
    evidence: [
      `Residual risk is ${record.residualRiskRating} for ${record.riskStatement}.`,
      record.keyControls.length > 0 ? `Key controls: ${record.keyControls.join(", ")}.` : "",
      `Last reviewed: ${record.lastReviewed}.`,
    ].filter((value) => value.trim().length > 0),
    keyControls: record.keyControls,
    lastReviewed: record.lastReviewed,
    residualRiskRating: record.residualRiskRating,
    riskStatement: record.riskStatement,
  }));
  const citationCount =
    normalizedSources.reduce((sum, source) => sum + source.evidence.length, 0) +
    normalizedRcsa.reduce((sum, record) => sum + record.evidence.length, 0);
  const generatedAt = new Date().toISOString();
  const payload = {
    audit: {
      currentPhase,
      name: auditLabel,
    },
    instructions: {
      citationFormat: '[SOURCE_ID | artifact label | "quoted excerpt"]',
      useOnlyProvidedEvidence: true,
    },
    planningInputs: normalizedSources,
    rcsaRecords: normalizedRcsa,
  };

  return {
    json: JSON.stringify(payload, null, 2),
    metadata: {
      citationCount,
      generatedAt,
      planningSourceCount: normalizedSources.length,
      rcsaCount: normalizedRcsa.length,
    },
    prompt: buildScopePromptText({
      auditLabel,
      currentPhase,
      hasInputs: normalizedSources.length > 0 || normalizedRcsa.length > 0,
      planningSourceCount: normalizedSources.length,
      rcsaCount: normalizedRcsa.length,
    }),
  };
}

function buildScopePromptText({
  auditLabel,
  currentPhase,
  hasInputs,
  planningSourceCount,
  rcsaCount,
}: {
  auditLabel: string;
  currentPhase: AuditPhase;
  hasInputs: boolean;
  planningSourceCount: number;
  rcsaCount: number;
}) {
  if (!hasInputs) {
    return [
      `You are helping define the audit scope for "${auditLabel}".`,
      `Current phase: ${currentPhase}.`,
      "",
      "No planning inputs or RCSA records were provided in the JSON companion.",
      "Do not invent scope recommendations.",
      "Instead, return:",
      "1. A short explanation that the evidence is insufficient.",
      "2. The minimum planning inputs needed before a scope recommendation can be justified.",
      "3. The specific types of evidence that would most influence in-scope, limited-scope, and out-of-scope decisions.",
      "",
      "Do not cite sources that are not present in the provided JSON.",
    ].join("\n");
  }

  return [
    `You are helping define the audit scope for "${auditLabel}".`,
    `Current phase: ${currentPhase}.`,
    `Use the JSON companion I provide with this prompt. It contains ${planningSourceCount} planning source inputs and ${rcsaCount} RCSA records.`,
    "",
    "Your job is to recommend the scope of the audit using only the evidence in that JSON.",
    "Do not invent facts, risks, systems, vendors, controls, or evidence outside the provided inputs.",
    "",
    "Return your response in this structure:",
    "1. Executive summary",
    "2. Recommended in-scope areas",
    "3. Recommended targeted-scope or watchlist areas",
    "4. Recommended out-of-scope or limited-scope areas",
    "5. Open questions or missing inputs",
    "",
    "For every recommendation, include inline citations using this exact pattern:",
    '[SOURCE_ID | artifact label | "quoted excerpt"]',
    "",
    "Citation rules:",
    "- Every recommendation must have at least one inline citation.",
    "- Quote only from the provided planning inputs or RCSA evidence.",
    "- If multiple sources support the same recommendation, cite multiple excerpts inline.",
    "- If the evidence is weak or conflicting, say so explicitly and cite the conflicting inputs.",
    "",
    "Decision rules:",
    "- Use high residual-risk RCSA themes to justify deeper scope where supported.",
    "- Use open issues, monitoring signals, prior findings, applications, and third-party records to justify scope depth, dependency coverage, or watchlist treatment.",
    "- If evidence is insufficient for a confident recommendation, place the area under open questions instead of overstating the scope.",
    "",
    "Keep the response concise but specific and evidence-based.",
  ].join("\n");
}

function getPlanningReadinessItems({
  auditId,
  planningSources,
  rcsaRecords,
}: {
  auditId: string | null;
  planningSources: PlanningSourceSet[];
  rcsaRecords: RCSARecord[];
}): Array<{ label: string; detail: string; status: string; tone: "success" | "warning" | "risk" }> {
  const highRiskCount = rcsaRecords.filter((record) => record.residualRiskRating === "HIGH").length;
  const staleSourceCount = planningSources.filter((source) => {
    const ageMs = Date.now() - new Date(source.lastUpdated).getTime();
    return Number.isFinite(ageMs) && ageMs > 1000 * 60 * 60 * 24 * 120;
  }).length;

  return [
    {
      label: "Source package consolidated",
      detail:
        planningSources.length > 0
          ? `${planningSources.length} planning inputs are loaded into the audit workspace.`
          : "No planning inputs are loaded yet for this audit.",
      status: planningSources.length > 0 ? "Complete" : "Missing",
      tone: planningSources.length > 0 ? "success" : "risk",
    },
    {
      label: "RCSA alignment reviewed",
      detail:
        rcsaRecords.length > 0
          ? `${rcsaRecords.length} RCSA records are available, including ${highRiskCount} high-risk items.`
          : "No RCSA records are loaded yet for this audit.",
      status: rcsaRecords.length > 0 ? "Complete" : "Missing",
      tone: rcsaRecords.length > 0 ? "success" : "risk",
    },
    {
      label: "Planning narrative readiness",
      detail: auditId
        ? "Narrative generation is available from the current live planning data."
        : "Save the audit in live mode before generating a planning narrative.",
      status: auditId ? "Ready" : "Blocked",
      tone: auditId ? "warning" : "risk",
    },
    {
      label: "Planning tollgate readiness",
      detail: auditId
        ? "Tollgate generation is available from the current live planning data."
        : "Save the audit in live mode before generating a planning tollgate.",
      status: auditId ? "Ready" : "Blocked",
      tone: auditId ? "warning" : "risk",
    },
    {
      label: "Planning data freshness",
      detail:
        staleSourceCount > 0
          ? `${staleSourceCount} loaded planning inputs appear stale and should be refreshed before fieldwork.`
          : "Loaded planning inputs are recent enough to support fieldwork entry.",
      status: staleSourceCount > 0 ? "Refresh needed" : "Current",
      tone: staleSourceCount > 0 ? "warning" : "success",
    },
  ];
}

function formatCadence(value: PlanningSourceSet["refreshCadence"]) {
  return value.replaceAll("_", " ");
}

