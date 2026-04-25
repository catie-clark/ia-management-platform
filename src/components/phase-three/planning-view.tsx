"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowRight, Bot, ChevronDown, FileText, Layers3, ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { PhaseCompletionCard } from "@/components/phase-three/phase-completion-card";
import { DetailPanel } from "@/components/ui/detail-panel";
import { useNotification } from "@/components/ui/notification-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/utils";
import type { AuditPhase, PlanningSourceSet, RCSARecord } from "@/types/audit";

type SourceFilter = PlanningSourceSet["sourceType"] | "ALL";
type NarrativePreviewSection = {
  body: string[];
  heading: string;
};

type PlanningNarrativeDraftResponse = {
  draft: {
    documentId: string | null;
    generatedAt: string;
    markdown: string;
    missingRequiredTokens: string[];
    previewSections: NarrativePreviewSection[];
    previewSummary: string;
    status: string;
    templateName: string | null;
    title: string;
  } | null;
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
  auditStatus = "prototype",
  currentPhase = "Planning",
  planningSources,
  rcsaRecords,
}: {
  auditId?: string | null;
  auditLabel?: string;
  auditStatus?: string;
  currentPhase?: AuditPhase;
  planningSources: PlanningSourceSet[];
  rcsaRecords: RCSARecord[];
}) {
  const [selectedSourceType, setSelectedSourceType] = useState<SourceFilter>("ALL");
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [isSuggestionVisible, setIsSuggestionVisible] = useState(false);
  const [isNarrativeCollapsed, setIsNarrativeCollapsed] = useState(false);
  const [isTollgateCollapsed, setIsTollgateCollapsed] = useState(false);

  const filteredSources = useMemo(() => {
    return planningSources.filter((source) => selectedSourceType === "ALL" || source.sourceType === selectedSourceType);
  }, [planningSources, selectedSourceType]);
  const selectedSource = planningSources.find((source) => source.id === selectedSourceId) ?? null;
  const scopeSuggestions = useMemo(() => getScopeSuggestions(rcsaRecords, planningSources), [planningSources, rcsaRecords]);

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
    <div>
      <PageHeader
        eyebrow="Phase 3"
        title="Planning"
        description="Planning consolidates source intelligence, RCSA grounding, static scope recommendations, and the draft outputs needed to move into controlled fieldwork."
        phaseStatus={{ label: currentPhase === "Planning" ? "Active" : `Current phase: ${currentPhase}`, active: currentPhase === "Planning" }}
      />

      <div className="mb-6">
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
          detail="Current-state indicators feeding the static AI suggestion panel"
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
          <section className="flex h-[760px] flex-col rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
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
          </section>

          <PlanningNarrativeCard
            auditId={auditId}
            auditLabel={auditLabel}
            currentPhase={currentPhase}
            isCollapsed={isNarrativeCollapsed}
            onToggleCollapsed={() => setIsNarrativeCollapsed((current) => !current)}
          />

          <DraftCard
            label="Planning tollgate"
            title="Generate planning tollgate draft"
            description="Generate a planning tollgate draft that frames the current planning decision points, unresolved dependencies, and leadership discussion needed before fieldwork begins."
            bullets={[
              "Decision ask: confirm deeper testing of sanctions alert triage and case escalation timing.",
              "Dependency: finalize planning narrative wording and align owner assignments for early fieldwork workpapers.",
              "Watch item: planning tollgate deck remains the only artifact still clearly at risk.",
            ]}
            isCollapsed={isTollgateCollapsed}
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
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Static AI scope suggestion</p>
                  <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">Where planning should lean in</h3>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(245,168,0,0.18)] bg-[rgba(245,168,0,0.08)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-amber-dark)]">
                <Bot size={14} />
                AI Insight
              </div>
            </div>

            <div
              className={`mt-5 grid gap-3 transition-all duration-500 ${
                isSuggestionVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
              }`}
            >
              {scopeSuggestions.map((item) => (
                <div key={item.title} className="rounded-[20px] bg-white px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{item.title}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{item.reason}</p>
                    </div>
                    <StatusBadge status={item.priority} tone={item.priority === "HIGH" ? "risk" : "warning"} />
                  </div>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    Source basis: {item.provenance}
                  </p>
                  <div className="mt-4 grid gap-2">
                    {item.citations.map((citation) => (
                      <div key={`${item.title}-${citation.sourceId}`} className="rounded-[16px] border border-black/5 bg-[var(--surface-tint)] px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={citation.sourceId} tone="neutral" />
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                            {citation.documentLabel}
                          </p>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{citation.excerpt}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Planning readiness</p>
            <h3 className="mt-3 text-lg font-semibold text-[var(--foreground)]">Required artifacts before fieldwork</h3>
            <div className="mt-5 grid gap-3">
              {[
                ["Source package consolidated", "Complete", "success"],
                ["RCSA alignment reviewed", "Complete", "success"],
                ["Planning narrative draft", "In progress", "warning"],
                ["Planning tollgate deck", "At risk", "risk"],
              ].map(([label, status, tone]) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-[18px] bg-[var(--surface-tint)] px-4 py-3">
                  <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
                  <StatusBadge status={status} tone={tone as "success" | "warning" | "risk"} />
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>

      {selectedSource ? (
        <DetailPanel
          title={`${selectedSource.id} · ${selectedSource.title}`}
          subtitle="Planning input detail shows what the source actually contains and how the team intends to use it in scope formation."
          open={Boolean(selectedSource)}
          onClose={() => setSelectedSourceId("")}
        >
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
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Generated sample input content</p>
              <div className="mt-4 grid gap-3">
                {selectedSource.sampleDetails.map((detail) => (
                  <div key={detail} className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3 text-sm text-[var(--muted)]">
                    {detail}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </DetailPanel>
      ) : null}
    </div>
  );
}

function PlanningNarrativeCard({
  auditId,
  auditLabel,
  currentPhase,
  isCollapsed,
  onToggleCollapsed,
}: {
  auditId: string | null;
  auditLabel: string;
  currentPhase: AuditPhase;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const { showNotification } = useNotification();
  const [error, setError] = useState("");
  const [documentStatus, setDocumentStatus] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [missingTokens, setMissingTokens] = useState<string[]>([]);
  const [previewSections, setPreviewSections] = useState<NarrativePreviewSection[]>([]);
  const [previewSummary, setPreviewSummary] = useState("");

  const resetDraftState = () => {
    setDocumentStatus("");
    setDraftTitle("");
    setGeneratedAt("");
    setMarkdown("");
    setMissingTokens([]);
    setPreviewSections([]);
    setPreviewSummary("");
    setIsDraftLoaded(true);
  };

  useEffect(() => {
    if (!auditId) {
      return;
    }

    startTransition(async () => {
      try {
        setError("");
        const response = await fetch(`/api/audits/${auditId}/planning-narrative`);
        const result = (await response.json()) as PlanningNarrativeDraftResponse & { error?: string };

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to load the planning narrative draft.");
        }

        if (!result.draft) {
          resetDraftState();
          return;
        }

        setDraftTitle(result.draft.title);
        setDocumentStatus(result.draft.status);
        setGeneratedAt(result.draft.generatedAt);
        setMarkdown(result.draft.markdown);
        setMissingTokens(result.draft.missingRequiredTokens);
        setPreviewSections(result.draft.previewSections);
        setPreviewSummary(result.draft.previewSummary);
        setIsDraftLoaded(true);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load the planning narrative draft.");
      }
    });
  }, [auditId]);

  return (
    <article className={`rounded-[28px] border border-black/5 bg-white shadow-[0_18px_50px_rgba(1,30,65,0.08)] ${isCollapsed ? "px-4 py-3" : "p-6"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Planning narrative</p>
          <h2 className={`font-semibold text-[var(--foreground)] ${isCollapsed ? "mt-1 text-lg leading-6" : "mt-3 text-2xl"}`}>Generate planning narrative draft</h2>
          {isCollapsed ? (
            <p className="mt-1 text-sm leading-6 text-[var(--foreground)]">
              {auditId
                ? `Generate a planning narrative for ${auditLabel} using the current imported audit data and mapped planning template fields.`
                : "Generation is only available for saved live audits because the narrative is built from imported audit records."}
            </p>
          ) : (
            <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">
              {auditId
                ? `Generate a planning narrative for ${auditLabel} using the current imported audit data and mapped planning template fields.`
                : "Generation is only available for saved live audits because the narrative is built from imported audit records."}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-start gap-3">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white p-2 text-[var(--brand-indigo-core)]"
            aria-label={isCollapsed ? "Expand planning narrative" : "Collapse planning narrative"}
            aria-expanded={!isCollapsed}
          >
            <ChevronDown size={18} className={`transition-transform duration-200 ${isCollapsed ? "-rotate-90" : "rotate-0"}`} />
          </button>
          {!isCollapsed ? (
            <>
              <button
                type="button"
                disabled={!auditId || isPending}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      setError("");
                      const response = await fetch(`/api/audits/${auditId}/planning-narrative`, {
                        method: "POST",
                      });
                      const result = (await response.json()) as PlanningNarrativeDraftResponse & { error?: string };

                      if (!response.ok) {
                        throw new Error(result.error ?? "Unable to generate the planning narrative.");
                      }

                      if (!result.draft) {
                        throw new Error("Planning narrative generation returned no draft.");
                      }

                      setDraftTitle(result.draft.title);
                      setDocumentStatus(result.draft.status);
                      setGeneratedAt(result.draft.generatedAt);
                      setMarkdown(result.draft.markdown);
                      setMissingTokens(result.draft.missingRequiredTokens);
                      setPreviewSections(result.draft.previewSections);
                      setPreviewSummary(result.draft.previewSummary);
                      setIsDraftLoaded(true);
                      showNotification({
                        title: "Saved successfully",
                        message: "The planning narrative draft was generated successfully.",
                        tone: "success",
                      });
                    } catch {
                      setError("Unable to generate the planning narrative.");
                      showNotification({
                        title: "Save failed",
                        message: "There was an error generating the planning narrative draft.",
                        tone: "error",
                      });
                    }
                  });
                }}
                className="inline-flex items-center justify-center rounded-full bg-[var(--brand-indigo-core)] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Generating..." : "Generate narrative"}
              </button>
              <button
                type="button"
                disabled={!auditId || isPending || (!draftTitle && markdown.trim().length === 0 && previewSections.length === 0)}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      setError("");
                      const response = await fetch(`/api/audits/${auditId}/planning-narrative`, {
                        method: "DELETE",
                      });
                      const result = (await response.json()) as PlanningNarrativeDraftResponse & { error?: string };

                      if (!response.ok) {
                        throw new Error(result.error ?? "Unable to reset the planning narrative.");
                      }

                      resetDraftState();
                      showNotification({
                        title: "Saved successfully",
                        message: "The planning narrative draft was reset successfully.",
                        tone: "success",
                      });
                    } catch {
                      setError("Unable to reset the planning narrative.");
                      showNotification({
                        title: "Save failed",
                        message: "There was an error resetting the planning narrative draft.",
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
        <div className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3 text-sm text-[var(--muted)]">
          Current phase: {currentPhase}. Imported planning sources and setup data will be mapped into the narrative sections automatically.
        </div>
        {generatedAt ? (
          <div className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3 text-sm text-[var(--muted)]">
            Generated {formatDateTime(generatedAt)}.
          </div>
        ) : null}
        {draftTitle ? (
          <div className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3 text-sm text-[var(--muted)]">
            Saved draft: {draftTitle}
            {documentStatus ? ` | ${documentStatus.replaceAll("_", " ")}` : ""}
          </div>
        ) : null}
        {missingTokens.length > 0 ? (
          <div className="rounded-[18px] border border-[rgba(245,168,0,0.2)] bg-[rgba(245,168,0,0.08)] px-4 py-3 text-sm text-[var(--brand-amber-dark)]">
            Missing required template tokens: {missingTokens.join(", ")}
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
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Editable draft</p>
            <button
              type="button"
              disabled={!auditId || isPending || markdown.trim().length === 0}
              onClick={() => {
                startTransition(async () => {
                  try {
                    setError("");
                    const response = await fetch(`/api/audits/${auditId}/planning-narrative`, {
                      method: "PATCH",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({ markdown }),
                    });
                    const result = (await response.json()) as PlanningNarrativeDraftResponse & { error?: string };

                    if (!response.ok) {
                      throw new Error(result.error ?? "Unable to save the planning narrative.");
                    }

                    if (!result.draft) {
                      throw new Error("Planning narrative save returned no draft.");
                    }

                    setDraftTitle(result.draft.title);
                    setDocumentStatus(result.draft.status);
                    setGeneratedAt(result.draft.generatedAt);
                    setMissingTokens(result.draft.missingRequiredTokens);
                    setPreviewSections(result.draft.previewSections);
                    setPreviewSummary(result.draft.previewSummary);
                    showNotification({
                      title: "Saved successfully",
                      message: "The planning narrative draft was saved successfully.",
                      tone: "success",
                    });
                  } catch {
                    setError("Unable to save the planning narrative.");
                    showNotification({
                      title: "Save failed",
                      message: "There was an error saving the planning narrative draft.",
                      tone: "error",
                    });
                  }
                });
              }}
              className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Save edits"}
            </button>
          </div>
          <textarea
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
            rows={18}
            placeholder={
              isDraftLoaded
                ? "Generate a draft, then edit the narrative here."
                : "Loading draft..."
            }
            className="mt-4 w-full resize-y rounded-[18px] border border-black/5 bg-white px-4 py-4 font-mono text-sm leading-7 text-[var(--foreground)] outline-none"
          />
        </section>

        <section className="rounded-[20px] border border-black/5 bg-[#fcfbf8] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Formatted preview</p>
          {previewSections.length > 0 ? (
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
                            <span className="pt-[0.35rem] text-[var(--muted)]">•</span>
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
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              No narrative has been generated yet. Use the action above to build a draft from the current audit record, imported planning inputs, issues, RCSA data, monitoring results, prior findings, and planning setup fields.
            </p>
          )}
        </section>
      </div>
        </>
      ) : null}
    </article>
  );
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

function DraftCard({
  label,
  title,
  description,
  bullets,
  isCollapsed,
  onToggleCollapsed,
}: {
  label: string;
  title: string;
  description: string;
  bullets: string[];
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <article className={`rounded-[28px] border border-black/5 bg-white shadow-[0_18px_50px_rgba(1,30,65,0.08)] ${isCollapsed ? "px-4 py-3" : "p-6"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{label}</p>
          <h2 className={`font-semibold text-[var(--foreground)] ${isCollapsed ? "mt-1 text-lg leading-6" : "mt-3 text-2xl"}`}>{title}</h2>
          <p className={isCollapsed ? "mt-1 text-sm leading-6 text-[var(--foreground)]" : "mt-3 text-sm leading-7 text-[var(--foreground)]"}>{description}</p>
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white p-2 text-[var(--brand-indigo-core)]"
          aria-label={isCollapsed ? `Expand ${label}` : `Collapse ${label}`}
          aria-expanded={!isCollapsed}
        >
          <ChevronDown size={18} className={`transition-transform duration-200 ${isCollapsed ? "-rotate-90" : "rotate-0"}`} />
        </button>
      </div>
      {!isCollapsed ? (
        <>
          <div className="mt-5 grid gap-3">
            {bullets.map((bullet) => (
              <div key={bullet} className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3 text-sm text-[var(--muted)]">
                {bullet}
              </div>
            ))}
          </div>
        </>
      ) : null}
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

function getSourceTone(sourceType: PlanningSourceSet["sourceType"]) {
  if (sourceType === "OUTSTANDING_ISSUE" || sourceType === "PRIOR_FINDING" || sourceType === "NEWS") {
    return "risk";
  }

  if (sourceType === "CONTINUOUS_MONITORING" || sourceType === "REGULATORY_UPDATE") {
    return "warning";
  }

  return "neutral";
}

function getScopeSuggestions(records: RCSARecord[], sources: PlanningSourceSet[]) {
  const suggestions = [
    {
      title: "Deepen sanctions and escalation testing",
      reason: "Compliance and BSA sources both point to timing breakdowns and incomplete secondary review evidence.",
      priority: "HIGH",
      provenance: "RCSA, prior finding, outstanding issue",
      citations: [
        {
          sourceId: "P-04",
          documentLabel: "Business Unit RCSA Output",
          excerpt: "Residual risk: High due to alert closure timing and secondary-review dependency.",
        },
        {
          sourceId: "P-06",
          documentLabel: "Prior Audit Finding Summary",
          excerpt: "Prior finding theme: escalation SLA misses in a high-risk case population.",
        },
      ],
    },
    {
      title: "Validate treasury exception handling end to end",
      reason: "Continuous monitoring and treasury RCSA data both indicate unresolved breaks and manual clears.",
      priority: "HIGH",
      provenance: "Continuous monitoring, RCSA",
      citations: [
        {
          sourceId: "P-05",
          documentLabel: "Daily Settlement Exception Aging Feed",
          excerpt: "March 29 spike: 17 unresolved exceptions exceeded 48 hours.",
        },
        {
          sourceId: "P-01",
          documentLabel: "Critical Vendor Due Diligence Packet",
          excerpt: "Criticality rating: Tier 1 payment processor supporting retail card settlement.",
        },
      ],
    },
    {
      title: "Keep vendor and data governance coverage targeted",
      reason: "External signals exist, but current evidence suggests these areas should stay scoped to focused validation rather than broad expansion.",
      priority: "MEDIUM",
      provenance: "Third-party source, regulatory update, news",
      citations: [
        {
          sourceId: "P-01",
          documentLabel: "Critical Vendor Due Diligence Packet",
          excerpt: "Interim action: risk committee approved temporary extension through April 30 pending updated packet.",
        },
        {
          sourceId: "P-07",
          documentLabel: "Regulatory Bulletin Summary",
          excerpt: "Planning implication: preserve focused testing around exception register completeness and aging follow-up.",
        },
      ],
    },
  ];

  return suggestions.filter((item) => {
    if (item.priority === "HIGH") {
      return records.some((record) => record.residualRiskRating === "HIGH");
    }

    return sources.length > 0;
  });
}

function formatCadence(value: PlanningSourceSet["refreshCadence"]) {
  return value.replaceAll("_", " ");
}
