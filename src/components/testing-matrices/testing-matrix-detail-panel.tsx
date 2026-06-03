"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Copy, Download, Expand, FilePenLine, Minimize2, Plus, Trash2, X } from "lucide-react";

import { AttachmentReferencePanel } from "@/components/attachments/attachment-reference-panel";
import { SampleGenerator } from "@/components/testing-matrices/sample-generator";
import { useActiveUser } from "@/components/layout/active-user-context";
import { DetailPanel } from "@/components/ui/detail-panel";
import type { SampleGenerationResult } from "@/lib/sampling";
import { useNotification } from "@/components/ui/notification-provider";
import type { DashboardMode } from "@/lib/live-audit";
import { buildDefaultTestingMatrixAttributes } from "@/lib/testing-matrix-defaults";
import { cn, formatDateTime } from "@/lib/utils";
import type {
  AuditDocument,
  Control,
  ControlTestingMatrix,
  ControlTestingMatrixAttribute,
  ControlTestingMatrixResult,
  ControlTestingMatrixSample,
  TestingMatrixAttributeResult,
  User,
} from "@/types/audit";

type TestingMatrixDetailPanelProps = {
  auditId: string | null;
  contained?: boolean;
  control: Control;
  controlAttachments?: AuditDocument[];
  matrices: ControlTestingMatrix[];
  mode: DashboardMode;
  onClose: () => void;
  onMatricesUpdated: (nextMatrices: ControlTestingMatrix[]) => void;
  panelClassName?: string;
  users?: User[];
};

type SaveResponse = {
  error?: string;
  matrix?: ControlTestingMatrix;
  matrices?: ControlTestingMatrix[];
};

type DeleteResponse = {
  error?: string;
  matrices?: ControlTestingMatrix[];
};

export function TestingMatrixDetailPanel({
  auditId,
  contained = false,
  control,
  controlAttachments = [],
  matrices,
  mode,
  onClose,
  onMatricesUpdated,
  panelClassName = "top-4 right-4 h-[calc(100dvh-2rem)] max-w-[76rem] overflow-y-auto rounded-[16px] border border-black/10 bg-[#f6f1e8] sm:p-4",
  users = [],
}: TestingMatrixDetailPanelProps) {
  const router = useRouter();
  const { showNotification } = useNotification();
  const { activeUser } = useActiveUser();
  const [isPending, setIsPending] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [attributesCollapsed, setAttributesCollapsed] = useState(true);
  const [drafts, setDrafts] = useState<ControlTestingMatrix[]>(() => buildInitialMatrixDrafts(matrices, control, auditId));
  const [activeMatrixId, setActiveMatrixId] = useState(() => drafts[0]?.id ?? "");
  const canPersist = mode === "live" && Boolean(auditId);

  useEffect(() => {
    const nextDrafts = buildInitialMatrixDrafts(matrices, control, auditId);
    setDrafts(nextDrafts);
    setActiveMatrixId((current) => (nextDrafts.some((candidate) => candidate.id === current) ? current : nextDrafts[0]?.id ?? ""));
  }, [auditId, control, matrices]);

  const draft = drafts.find((candidate) => candidate.id === activeMatrixId) ?? drafts[0] ?? buildEmptyTestingMatrix(control, auditId);
  const baselineDrafts = useMemo(() => buildInitialMatrixDrafts(matrices, control, auditId), [auditId, control, matrices]);

  const resultLookup = useMemo(() => {
    return draft.results.reduce<Record<string, TestingMatrixAttributeResult>>((lookup, result) => {
      lookup[`${result.sampleId}:${result.attributeId}`] = result.result;
      return lookup;
    }, {});
  }, [draft.results]);
  const normalizedDraft = useMemo(() => normalizeMatrixDraft(draft, { includeTimestamp: false }), [draft]);
  const normalizedBaseline = useMemo(() => {
    const baseline = baselineDrafts.find((candidate) => candidate.id === draft.id);
    return baseline ? normalizeMatrixDraft(baseline, { includeTimestamp: false }) : null;
  }, [baselineDrafts, draft.id]);
  const hasUnsavedChanges = useMemo(
    () => !isPersistedId(draft.id) || JSON.stringify(normalizedDraft) !== JSON.stringify(normalizedBaseline),
    [normalizedBaseline, normalizedDraft],
  );
  const isCollapsedView = !isExpanded;

  const content = (
    <div className="grid gap-3">
      <section className="border border-[rgba(1,30,65,0.14)] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(1,30,65,0.05)]">
        <div
          className={cn(
            "flex flex-wrap items-start justify-between gap-3 border-b border-black/10 pb-3",
            isCollapsedView && "sticky top-0 z-20 -mx-4 -mt-3 bg-white px-4 pt-3 shadow-[0_1px_0_rgba(1,30,65,0.08)]",
          )}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Testing Matrix</p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">{draft.title}</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Worksheet-style attribute testing with compact control metadata and sample-level results.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
              onClick={handleSave}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-sm bg-[var(--brand-indigo-core)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FilePenLine size={15} />
              {isPending ? "Saving..." : "Save matrix"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            {drafts.map((matrixDraft, index) => (
              <button
                key={matrixDraft.id}
                type="button"
                onClick={() => handleSelectMatrix(matrixDraft.id)}
                disabled={isPending}
                className={cn(
                  "inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]",
                  matrixDraft.id === draft.id
                    ? "border-[rgba(0,46,98,0.22)] bg-[var(--brand-indigo-core)] text-white"
                    : "border-black/10 bg-white text-[var(--brand-indigo-core)]",
                )}
              >
                {matrixDraft.title.trim() || `Test Plan ${index + 1}`}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleAddMatrix()}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-sm border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-indigo-core)]"
            >
              <Plus size={14} />
              Add matrix
            </button>
            <button
              type="button"
              onClick={() => void handleDuplicateMatrix()}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-sm border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-indigo-core)]"
            >
              <Copy size={14} />
              Duplicate
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={!canPersist || isPending}
              title="Export the testing workpaper and all testing matrices for this control as a formatted Excel bundle."
              className="inline-flex items-center gap-2 rounded-sm border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download size={14} />
              Export bundle
            </button>
            <button
              type="button"
              onClick={handleDeleteMatrix}
              disabled={isPending || drafts.length <= 1}
              className="inline-flex items-center gap-2 rounded-sm border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </div>

        <dl className="mt-3 grid gap-x-3 gap-y-2 sm:grid-cols-2">
          <MetaCell label="Control" value={`${control.referenceId ?? control.id} - ${control.name}`} />
          <MetaCell label="Last Update" value={draft.updatedAt ? formatDateTime(draft.updatedAt) : "Not saved yet"} />
        </dl>

        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <EditorField
            className="md:col-span-2"
            label="Title"
            value={draft.title}
            onChange={(value) => updateActiveDraft((current) => ({ ...current, title: value }))}
          />
          <EditorNumberField
            label="Population size"
            value={draft.populationSize}
            onChange={(value) => updateActiveDraft((current) => ({ ...current, populationSize: value }))}
          />
          <EditorNumberField
            label="Sample size"
            value={draft.samples.length}
            onChange={handleSampleSizeChange}
          />
          <EditorAreaField
            className="md:col-span-4"
            label="Population description"
            value={draft.populationDescription}
            onChange={(value) => updateActiveDraft((current) => ({ ...current, populationDescription: value }))}
          />
          <EditorAreaField
            className="md:col-span-4"
            label="Test Plan"
            minRows={8}
            value={draft.sampleDescription}
            onChange={(value) => updateActiveDraft((current) => ({ ...current, sampleDescription: value }))}
          />
        </div>
      </section>

      <AttachmentReferencePanel
        attachments={controlAttachments}
        auditId={auditId}
        description="Open control support while completing sample testing."
        emptyMessage="No control attachments are linked yet."
      />

      <section className="border border-[rgba(1,30,65,0.14)] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(1,30,65,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Attributes</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Define the checks applied to each sample row.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAttributesCollapsed((current) => !current)}
              className="inline-flex items-center gap-2 rounded-sm border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"
            >
              {attributesCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              {attributesCollapsed ? "Show attributes" : "Hide attributes"}
            </button>
            <button
              type="button"
              onClick={handleAddAttribute}
              className="inline-flex items-center gap-2 rounded-sm border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-indigo-core)]"
            >
              <Plus size={14} />
              Add attribute
            </button>
          </div>
        </div>

        {!attributesCollapsed ? (
          <div className="mt-4 grid gap-3">
            {draft.attributes.map((attribute) => (
              <div key={attribute.id} className="grid gap-3 border border-black/5 bg-[var(--surface-tint)] p-3 md:grid-cols-[1.2fr_1fr_auto]">
                <EditorField
                  label="Attribute label"
                  value={attribute.label}
                  onChange={(value) => {
                    updateActiveDraft((current) => ({
                      ...current,
                      attributes: current.attributes.map((item) => (item.id === attribute.id ? { ...item, label: value } : item)),
                    }));
                  }}
                />
                <EditorField
                  label="Guidance"
                  value={attribute.guidance}
                  onChange={(value) => {
                    updateActiveDraft((current) => ({
                      ...current,
                      attributes: current.attributes.map((item) => (item.id === attribute.id ? { ...item, guidance: value } : item)),
                    }));
                  }}
                />
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => handleRemoveAttribute(attribute.id)}
                    className="inline-flex h-9 items-center gap-2 rounded-sm border border-black/10 bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="border border-[rgba(1,30,65,0.14)] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(1,30,65,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Sample testing</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Evaluate each attribute for every sample item and capture only row-level exceptions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SampleGenerator defaultPopulationSize={draft.populationSize} onApply={applyGeneratedSample} />
            <button
              type="button"
              onClick={handleAddSample}
              className="inline-flex items-center gap-2 rounded-sm border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-indigo-core)]"
            >
              <Plus size={14} />
              Add sample row
            </button>
          </div>
        </div>

        {isCollapsedView ? (
          <div className="mt-4 grid gap-3">
            {draft.samples.map((sample) => (
              <article key={sample.id} className="border border-black/10 bg-[#fffdfa] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[12rem_minmax(0,1fr)]">
                    <EditorField
                      label="Sample"
                      value={sample.sampleIdentifier}
                      onChange={(value) => updateSample(sample.id, { sampleIdentifier: value })}
                    />
                    <EditorAreaField
                      label="Description"
                      value={sample.sampleDescription}
                      onChange={(value) => updateSample(sample.id, { sampleDescription: value })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSample(sample.id)}
                    className="inline-flex h-9 items-center gap-2 rounded-sm border border-black/10 bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {draft.attributes.map((attribute) => {
                    const result = resultLookup[`${sample.id}:${attribute.id}`] ?? "NOT_TESTED";

                    return (
                      <label key={`${sample.id}:${attribute.id}`} className="grid gap-1">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                          {attribute.label || "Untitled attribute"}
                        </span>
                        <select
                          value={result}
                          onChange={(event) => updateResult(sample.id, attribute.id, event.target.value as TestingMatrixAttributeResult)}
                          className={cn(
                            "w-full border px-2 py-2 text-[13px] outline-none",
                            result === "PASS"
                              ? "border-[rgba(5,171,140,0.18)] bg-[rgba(5,171,140,0.08)] text-[var(--brand-teal-core)]"
                              : result === "FAIL"
                                ? "border-[rgba(229,55,107,0.18)] bg-[rgba(229,55,107,0.08)] text-[var(--brand-coral)]"
                                : "border-black/5 bg-white text-[var(--foreground)]",
                          )}
                        >
                          <option value="NOT_TESTED">Not tested</option>
                          <option value="PASS">Pass</option>
                          <option value="FAIL">Fail</option>
                        </select>
                      </label>
                    );
                  })}
                </div>

                <div className="mt-3">
                  <EditorAreaField
                    label="Exception noted"
                    value={sample.exceptionNoted}
                    onChange={(value) => updateSample(sample.id, { exceptionNoted: value })}
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse border border-black/10">
              <thead className="sticky top-0 z-10 bg-[#efe8db]">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  <th className="border border-black/10 px-2 py-2">Sample</th>
                  <th className="border border-black/10 px-2 py-2 min-w-[15rem]">Description</th>
                  {draft.attributes.map((attribute) => (
                    <th key={attribute.id} className="border border-black/10 px-2 py-2 min-w-[10rem]">
                      {attribute.label || "Untitled attribute"}
                    </th>
                  ))}
                  <th className="border border-black/10 px-2 py-2 min-w-[14rem]">Exception noted</th>
                  <th className="border border-black/10 px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {draft.samples.map((sample) => (
                  <tr key={sample.id} className="bg-[#fffdfa]">
                    <td className="border border-black/10 px-2 py-2 align-top">
                      <input
                        value={sample.sampleIdentifier}
                        onChange={(event) => updateSample(sample.id, { sampleIdentifier: event.target.value })}
                        className="w-full border border-black/10 bg-white px-2 py-1.5 text-[13px] outline-none"
                      />
                    </td>
                    <td className="border border-black/10 px-2 py-2 align-top">
                      <textarea
                        value={sample.sampleDescription}
                        onChange={(event) => updateSample(sample.id, { sampleDescription: event.target.value })}
                        rows={2}
                        className="w-full resize-none border border-black/10 bg-white px-2 py-1.5 text-[13px] leading-5 outline-none"
                      />
                    </td>
                    {draft.attributes.map((attribute) => {
                      const result = resultLookup[`${sample.id}:${attribute.id}`] ?? "NOT_TESTED";

                      return (
                        <td key={`${sample.id}:${attribute.id}`} className="border border-black/10 px-2 py-2 align-top">
                          <select
                            value={result}
                            onChange={(event) => updateResult(sample.id, attribute.id, event.target.value as TestingMatrixAttributeResult)}
                            className={cn(
                              "w-full border px-2 py-1.5 text-[13px] outline-none",
                              result === "PASS"
                                ? "border-[rgba(5,171,140,0.18)] bg-[rgba(5,171,140,0.08)] text-[var(--brand-teal-core)]"
                                : result === "FAIL"
                                  ? "border-[rgba(229,55,107,0.18)] bg-[rgba(229,55,107,0.08)] text-[var(--brand-coral)]"
                                  : "border-black/5 bg-white text-[var(--foreground)]",
                            )}
                          >
                            <option value="NOT_TESTED">Not tested</option>
                            <option value="PASS">Pass</option>
                            <option value="FAIL">Fail</option>
                          </select>
                        </td>
                      );
                    })}
                    <td className="border border-black/10 px-2 py-2 align-top">
                      <textarea
                        value={sample.exceptionNoted}
                        onChange={(event) => updateSample(sample.id, { exceptionNoted: event.target.value })}
                        rows={2}
                        className="w-full resize-none border border-black/10 bg-white px-2 py-1.5 text-[13px] leading-5 outline-none"
                      />
                    </td>
                    <td className="border border-black/10 px-2 py-2 align-top">
                      <button
                        type="button"
                        onClick={() => handleRemoveSample(sample.id)}
                        className="inline-flex items-center gap-2 rounded-sm border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );

  const expandedOverlay = isExpanded ? (
    <>
      <button
        type="button"
        aria-label="Close expanded testing matrix"
        onClick={() => setIsExpanded(false)}
        className="fixed inset-0 z-[70] bg-[rgba(1,30,65,0.28)] backdrop-blur-[2px]"
      />
      <aside className="fixed inset-4 z-[80] flex flex-col overflow-hidden rounded-[14px] border border-black/10 bg-[#f6f1e8] p-4 shadow-[0_24px_80px_rgba(1,30,65,0.22)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Expanded testing matrix</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{draft.title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
              Expanded worksheet view for reviewing more of the matrix at once.
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
              onClick={handleClose}
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
            aria-label="Close testing matrix detail"
            onClick={handleClose}
            className="absolute inset-0 z-30 bg-[rgba(1,30,65,0.18)] backdrop-blur-[1px]"
          />
          <aside className="absolute inset-y-0 right-0 z-40 flex w-full max-w-[76rem] flex-col overflow-hidden border-l border-black/10 bg-[#f6f1e8] p-4 shadow-[-24px_0_60px_rgba(1,30,65,0.12)] sm:p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Testing matrix</p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{draft.title}</h2>
                <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
                  Condensed matrix worksheet for sample-level testing, attribute results, and exception notes.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
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
          title={draft.title}
          subtitle="Condensed matrix worksheet for sample-level results and exception notes."
          open={Boolean(draft)}
          onClose={handleClose}
          panelClassName={panelClassName}
        >
          {content}
        </DetailPanel>
      )}
      {expandedOverlay}
    </>
  );

  function updateActiveDraft(updater: (current: ControlTestingMatrix) => ControlTestingMatrix) {
    setDrafts((current) => current.map((matrixDraft) => (matrixDraft.id === draft.id ? updater(matrixDraft) : matrixDraft)));
  }

  function updateSample(sampleId: string, next: Partial<ControlTestingMatrixSample>) {
    updateActiveDraft((current) => ({
      ...current,
      samples: current.samples.map((sample) => (sample.id === sampleId ? { ...sample, ...next } : sample)),
    }));
  }

  function updateResult(sampleId: string, attributeId: string, value: TestingMatrixAttributeResult) {
    updateActiveDraft((current) => {
      const existing = current.results.find((result) => result.sampleId === sampleId && result.attributeId === attributeId);

      if (existing) {
        return {
          ...current,
          results: current.results.map((result) =>
            result.sampleId === sampleId && result.attributeId === attributeId ? { ...result, result: value } : result,
          ),
        };
      }

      return {
        ...current,
        results: [
          ...current.results,
          {
            id: "",
            matrixId: current.id,
            sampleId,
            attributeId,
            result: value,
          },
        ],
      };
    });
  }

  function handleAddAttribute() {
    updateActiveDraft((current) => {
      const attributeId = buildClientId("attribute");
      const nextAttribute: ControlTestingMatrixAttribute = {
        id: attributeId,
        matrixId: current.id,
        attributeKey: `attribute_${current.attributes.length + 1}`,
        label: "",
        guidance: "",
        displayOrder: current.attributes.length + 1,
      };

      return {
        ...current,
        attributes: [...current.attributes, nextAttribute],
        results: [
          ...current.results,
          ...current.samples.map<ControlTestingMatrixResult>((sample) => ({
            id: "",
            matrixId: current.id,
            sampleId: sample.id,
            attributeId,
            result: "NOT_TESTED",
          })),
        ],
      };
    });
  }

  function handleRemoveAttribute(attributeId: string) {
    updateActiveDraft((current) => ({
      ...current,
      attributes: current.attributes
        .filter((attribute) => attribute.id !== attributeId)
        .map((attribute, index) => ({ ...attribute, displayOrder: index + 1 })),
      results: current.results.filter((result) => result.attributeId !== attributeId),
    }));
  }

  function handleSampleSizeChange(value: number | undefined) {
    updateActiveDraft((current) => resizeSamples(current, value ?? 0));
  }

  function handleAddSample() {
    updateActiveDraft((current) => resizeSamples(current, current.samples.length + 1));
  }

  function applyGeneratedSample(result: SampleGenerationResult) {
    updateActiveDraft((current) => {
      const matrixId = current.id;
      const samples = result.items.map<ControlTestingMatrixSample>((item, index) => ({
        id: buildClientId("sample"),
        matrixId,
        sampleIdentifier: item.sampleIdentifier,
        sampleDescription: item.sampleDescription,
        sourceReference: item.sourceReference,
        exceptionNoted: "",
        displayOrder: index + 1,
      }));
      const results = samples.flatMap((sample) =>
        current.attributes.map<ControlTestingMatrixResult>((attribute) => ({
          id: "",
          matrixId,
          sampleId: sample.id,
          attributeId: attribute.id,
          result: "NOT_TESTED",
        })),
      );

      return {
        ...current,
        populationSize: current.populationSize ?? (result.populationSize > 0 ? result.populationSize : undefined),
        sampleSize: samples.length,
        samples,
        results,
        sampleDescription: appendSamplingMethodology(current.sampleDescription, result.methodology),
      };
    });

    showNotification({
      title: "Sample generated",
      message: `${result.items.length} sample items created. Methodology recorded in the test plan.`,
      tone: "success",
    });
  }

  function handleRemoveSample(sampleId: string) {
    updateActiveDraft((current) => {
      const nextSamples = current.samples
        .filter((sample) => sample.id !== sampleId)
        .map((sample, index) => ({ ...sample, displayOrder: index + 1 }));

      return {
        ...current,
        sampleSize: nextSamples.length,
        samples: nextSamples,
        results: current.results.filter((result) => result.sampleId !== sampleId),
      };
    });
  }

  async function handleAddMatrix() {
    const saved = await persistDraft({ notify: false, skipIfUnchanged: true });

    if (!saved) {
      return;
    }

    const nextDisplayOrder = drafts.length + 1;
    const nextMatrix = buildEmptyTestingMatrix(control, auditId, {
      displayOrder: nextDisplayOrder,
      sampleDescription: getSeedTestPlan(control, drafts),
      title: `Test Plan ${nextDisplayOrder}`,
    });

    setDrafts((current) => [...current, nextMatrix]);
    setActiveMatrixId(nextMatrix.id);
  }

  async function handleDuplicateMatrix() {
    const saved = await persistDraft({ notify: false, skipIfUnchanged: true });

    if (!saved) {
      return;
    }

    const nextDisplayOrder = drafts.length + 1;
    const nextMatrix = cloneMatrixDraft(draft, {
      displayOrder: nextDisplayOrder,
      title: `${draft.title || "Test Plan"} Copy`,
    });

    setDrafts((current) => [...current, nextMatrix]);
    setActiveMatrixId(nextMatrix.id);
  }

  async function handleSelectMatrix(nextMatrixId: string) {
    if (nextMatrixId === draft.id || isPending) {
      return;
    }

    const saved = await persistDraft({ notify: false, skipIfUnchanged: true });

    if (saved) {
      setActiveMatrixId(nextMatrixId);
    }
  }

  async function handleDeleteMatrix() {
    if (drafts.length <= 1 || isPending) {
      return;
    }

    const nextActiveDraft = drafts.find((candidate) => candidate.id !== draft.id) ?? drafts[0];

    if (!isPersistedId(draft.id) || !canPersist || !auditId) {
      const nextDrafts = drafts.filter((candidate) => candidate.id !== draft.id).map((candidate, index) => ({ ...candidate, displayOrder: index + 1 }));
      setDrafts(nextDrafts);
      onMatricesUpdated(nextDrafts);
      setActiveMatrixId(nextActiveDraft?.id ?? "");
      return;
    }

    setIsPending(true);

    try {
      const response = await fetch(
        `/api/controls/${control.id}/testing-matrix?auditId=${encodeURIComponent(auditId)}&matrixId=${encodeURIComponent(draft.id)}`,
        { method: "DELETE" },
      );
      const result = (await response.json()) as DeleteResponse;

      if (!response.ok || !result.matrices) {
        throw new Error(result.error ?? "Unable to delete the testing matrix.");
      }

      setDrafts(result.matrices);
      onMatricesUpdated(result.matrices);
      setActiveMatrixId(result.matrices[0]?.id ?? "");
      router.refresh();
      showNotification({
        title: "Matrix deleted",
        message: "The testing matrix was removed from this control.",
        tone: "success",
      });
    } catch (error) {
      showNotification({
        title: "Delete failed",
        message: error instanceof Error ? error.message : "Unable to delete the testing matrix.",
        tone: "error",
      });
    } finally {
      setIsPending(false);
    }
  }

  function handleExport() {
    if (!auditId) {
      return;
    }

    window.location.href = `/api/controls/${control.id}/testing-matrix/export?auditId=${encodeURIComponent(auditId)}`;
  }

  function handleSave() {
    void persistDraft({ notify: true });
  }

  async function handleClose() {
    if (isPending) {
      return;
    }

    const saved = await persistDraft({ notify: false, skipIfUnchanged: true });

    if (saved || !hasUnsavedChanges) {
      onClose();
    }
  }

  async function persistDraft({
    notify,
    skipIfUnchanged = false,
  }: {
    notify: boolean;
    skipIfUnchanged?: boolean;
  }) {
    const nextDraft = normalizeMatrixDraft(draft);

    if (skipIfUnchanged && !hasUnsavedChanges) {
      return true;
    }

    if (!canPersist || !auditId) {
      const nextDrafts = drafts.map((matrixDraft) => (matrixDraft.id === draft.id ? nextDraft : matrixDraft));
      onMatricesUpdated(nextDrafts);
      setDrafts(nextDrafts);

      if (notify) {
        showNotification({
          title: "Matrix saved",
          message: "The prototype testing matrix was updated in local state.",
          tone: "success",
        });
      }

      return true;
    }

    setIsPending(true);

    try {
      const response = await fetch(`/api/controls/${control.id}/testing-matrix`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auditId,
          testedByUserId: isPersistedId(activeUser.id) ? activeUser.id : undefined,
          matrix: {
            id: isPersistedId(nextDraft.id) ? nextDraft.id : undefined,
            displayOrder: nextDraft.displayOrder,
            title: nextDraft.title,
            populationDescription: nextDraft.populationDescription,
            populationSize: nextDraft.populationSize ?? null,
            sampleDescription: nextDraft.sampleDescription,
            sampleSize: nextDraft.sampleSize ?? null,
            budgetedHours: nextDraft.budgetedHours ?? null,
            conclusion: "",
            attributes: nextDraft.attributes.map((attribute) => ({
              clientId: attribute.id,
              id: isPersistedId(attribute.id) ? attribute.id : undefined,
              attributeKey: attribute.attributeKey,
              label: attribute.label,
              guidance: attribute.guidance,
              displayOrder: attribute.displayOrder,
            })),
            samples: nextDraft.samples.map((sample) => ({
              clientId: sample.id,
              id: isPersistedId(sample.id) ? sample.id : undefined,
              sampleIdentifier: sample.sampleIdentifier,
              sampleDescription: sample.sampleDescription,
              sourceReference: sample.sourceReference,
              exceptionNoted: sample.exceptionNoted,
              displayOrder: sample.displayOrder,
              timeSpentMinutes: sample.timeSpentMinutes ?? null,
            })),
            results: nextDraft.results.map((result) => ({
              id: isPersistedId(result.id) ? result.id : undefined,
              sampleId: result.sampleId,
              attributeId: result.attributeId,
              result: result.result,
            })),
          },
        }),
      });
      const result = (await response.json()) as SaveResponse;

      if (!response.ok || !result.matrix) {
        throw new Error(result.error ?? "Unable to save the testing matrix.");
      }

      const nextMatrices = result.matrices ?? drafts.map((matrixDraft) => (matrixDraft.id === draft.id ? result.matrix as ControlTestingMatrix : matrixDraft));
      setDrafts(nextMatrices);
      setActiveMatrixId(result.matrix.id);
      onMatricesUpdated(nextMatrices);

      if (notify) {
        showNotification({
          title: "Matrix saved",
          message: "The testing matrix was saved in the app.",
          tone: "success",
        });
      }

      return true;
    } catch (error) {
      showNotification({
        title: "Save failed",
        message: error instanceof Error ? error.message : "There was an error saving the testing matrix.",
        tone: "error",
      });
      return false;
    } finally {
      setIsPending(false);
    }
  }
}

function EditorField({
  className,
  label,
  onChange,
  value,
}: {
  className?: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className={cn("grid gap-1", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border border-black/10 bg-[#fffdfa] px-3 py-2 text-[13px] outline-none"
      />
    </label>
  );
}

function EditorNumberField({
  className,
  label,
  onChange,
  value,
}: {
  className?: string;
  label: string;
  onChange: (value: number | undefined) => void;
  value?: number;
}) {
  return (
    <label className={cn("grid gap-1", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</span>
      <input
        type="number"
        min="0"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
        className="border border-black/10 bg-[#fffdfa] px-3 py-2 text-[13px] outline-none"
      />
    </label>
  );
}

function EditorAreaField({
  className,
  label,
  minRows = 3,
  onChange,
  value,
}: {
  className?: string;
  label: string;
  minRows?: number;
  onChange: (value: string) => void;
  value: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return (
    <label className={cn("grid gap-1", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</span>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={minRows}
        className="resize-none overflow-hidden border border-black/10 bg-[#fffdfa] px-3 py-2 text-[13px] leading-5 outline-none"
      />
    </label>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border border-[rgba(1,30,65,0.08)] bg-[#fcfbf8] px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</dt>
      <dd className="text-sm font-medium text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

function appendSamplingMethodology(existing: string, methodology: string) {
  const marker = "Sampling methodology:";
  const kept = existing
    .split("\n")
    .filter((line) => !line.trim().startsWith(marker))
    .join("\n")
    .trimEnd();
  const note = `${marker} ${methodology}`;
  return kept.length > 0 ? `${kept}\n\n${note}` : note;
}

function buildInitialMatrixDrafts(matrices: ControlTestingMatrix[], control: Control, auditId: string | null) {
  return matrices.length > 0
    ? matrices.slice().sort((left, right) => left.displayOrder - right.displayOrder || left.createdAt.localeCompare(right.createdAt))
    : [buildEmptyTestingMatrix(control, auditId)];
}

function buildEmptyTestingMatrix(
  control: Control,
  auditId: string | null,
  options: {
    displayOrder?: number;
    sampleDescription?: string;
    title?: string;
  } = {},
): ControlTestingMatrix {
  const matrixId = buildClientId("matrix");
  const attributes: ControlTestingMatrixAttribute[] = buildDefaultTestingMatrixAttributes(matrixId).map((attribute) => ({
    ...attribute,
    id: buildClientId("attribute"),
  }));
  const samples: ControlTestingMatrixSample[] = [
    buildSample(matrixId, 0),
  ];

  return {
    id: matrixId,
    auditId: auditId ?? "",
    controlId: control.id,
    displayOrder: options.displayOrder ?? 1,
    title: options.title ?? `${control.name} Testing Matrix`,
    populationDescription: `Population includes all items subject to ${control.name} during the audit period.`,
    populationSize: undefined,
    sampleDescription: options.sampleDescription ?? control.importedTestPlan ?? "",
    sampleSize: samples.length,
    conclusion: "",
    attributes,
    samples,
    results: attributes.flatMap((attribute) =>
      samples.map<ControlTestingMatrixResult>((sample) => ({
        id: "",
        matrixId,
        sampleId: sample.id,
        attributeId: attribute.id,
        result: "NOT_TESTED",
      })),
    ),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function resizeSamples(draft: ControlTestingMatrix, nextSize: number): ControlTestingMatrix {
  const targetSize = Math.max(0, Math.floor(nextSize));

  if (targetSize === draft.samples.length) {
    return {
      ...draft,
      sampleSize: draft.samples.length,
      samples: draft.samples.map((sample, index) => ({ ...sample, displayOrder: index + 1 })),
    };
  }

  if (targetSize < draft.samples.length) {
    const samples = draft.samples.slice(0, targetSize).map((sample, index) => ({ ...sample, displayOrder: index + 1 }));
    const retainedSampleIds = new Set(samples.map((sample) => sample.id));

    return {
      ...draft,
      sampleSize: samples.length,
      samples,
      results: draft.results.filter((result) => retainedSampleIds.has(result.sampleId)),
    };
  }

  const samplesToAdd = Array.from({ length: targetSize - draft.samples.length }, (_, index) =>
    buildSample(draft.id, draft.samples.length + index),
  );
  const resultsToAdd = samplesToAdd.flatMap((sample) =>
    draft.attributes.map<ControlTestingMatrixResult>((attribute) => ({
      id: "",
      matrixId: draft.id,
      sampleId: sample.id,
      attributeId: attribute.id,
      result: "NOT_TESTED",
    })),
  );

  return {
    ...draft,
    sampleSize: targetSize,
    samples: [...draft.samples, ...samplesToAdd].map((sample, index) => ({ ...sample, displayOrder: index + 1 })),
    results: [...draft.results, ...resultsToAdd],
  };
}

function buildSample(matrixId: string, index: number): ControlTestingMatrixSample {
  return {
    id: buildClientId("sample"),
    matrixId,
    sampleIdentifier: `S-${String(index + 1).padStart(2, "0")}`,
    sampleDescription: "",
    sourceReference: "",
    exceptionNoted: "",
    displayOrder: index + 1,
  };
}

function getSeedTestPlan(control: Control, matrices: ControlTestingMatrix[]) {
  return control.importedTestPlan ?? matrices.find((matrix) => matrix.sampleDescription.trim().length > 0)?.sampleDescription ?? "";
}

function cloneMatrixDraft(
  draft: ControlTestingMatrix,
  options: {
    displayOrder: number;
    title: string;
  },
): ControlTestingMatrix {
  const matrixId = buildClientId("matrix");
  const attributeIdMap = new Map<string, string>();
  const sampleIdMap = new Map<string, string>();
  const attributes = draft.attributes.map((attribute) => {
    const attributeId = buildClientId("attribute");
    attributeIdMap.set(attribute.id, attributeId);

    return {
      ...attribute,
      id: attributeId,
      matrixId,
    };
  });
  const samples = draft.samples.map((sample) => {
    const sampleId = buildClientId("sample");
    sampleIdMap.set(sample.id, sampleId);

    return {
      ...sample,
      id: sampleId,
      matrixId,
      exceptionNoted: "",
    };
  });

  return {
    ...draft,
    id: matrixId,
    displayOrder: options.displayOrder,
    title: options.title,
    attributes,
    sampleSize: samples.length,
    samples,
    results: draft.results.flatMap((result) => {
      const sampleId = sampleIdMap.get(result.sampleId);
      const attributeId = attributeIdMap.get(result.attributeId);

      if (!sampleId || !attributeId) {
        return [];
      }

      return [
        {
          id: "",
          matrixId,
          sampleId,
          attributeId,
          result: "NOT_TESTED" as const,
        },
      ];
    }),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildClientId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function isPersistedId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeMatrixDraft(
  draft: ControlTestingMatrix,
  options: {
    includeTimestamp?: boolean;
  } = {},
): ControlTestingMatrix {
  return {
    ...draft,
    conclusion: "",
    displayOrder: draft.displayOrder,
    updatedAt: options.includeTimestamp ? new Date().toISOString() : draft.updatedAt,
    title: draft.title.trim(),
    populationDescription: draft.populationDescription.trim(),
    sampleDescription: draft.sampleDescription.trim(),
    sampleSize: draft.samples.length,
    attributes: draft.attributes.map((attribute, index) => ({
      ...attribute,
      label: attribute.label.trim(),
      guidance: attribute.guidance.trim(),
      displayOrder: index + 1,
    })),
    samples: draft.samples.map((sample, index) => ({
      ...sample,
      sampleIdentifier: sample.sampleIdentifier.trim() || `S-${String(index + 1).padStart(2, "0")}`,
      sampleDescription: sample.sampleDescription.trim(),
      exceptionNoted: sample.exceptionNoted.trim(),
      displayOrder: index + 1,
    })),
  };
}
