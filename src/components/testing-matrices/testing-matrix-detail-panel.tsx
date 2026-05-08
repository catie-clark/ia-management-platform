"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { FilePenLine, Plus, Trash2, X } from "lucide-react";

import { DetailPanel } from "@/components/ui/detail-panel";
import { useNotification } from "@/components/ui/notification-provider";
import type { DashboardMode } from "@/lib/live-audit";
import { cn, formatDateTime } from "@/lib/utils";
import type {
  Control,
  ControlTestingMatrix,
  ControlTestingMatrixAttribute,
  ControlTestingMatrixResult,
  ControlTestingMatrixSample,
  TestingMatrixAttributeResult,
} from "@/types/audit";

type TestingMatrixDetailPanelProps = {
  auditId: string | null;
  contained?: boolean;
  control: Control;
  matrix: ControlTestingMatrix | null;
  mode: DashboardMode;
  onClose: () => void;
  onMatrixUpdated: (nextMatrix: ControlTestingMatrix) => void;
  panelClassName?: string;
};

type SaveResponse = {
  error?: string;
  matrix?: ControlTestingMatrix;
};

export function TestingMatrixDetailPanel({
  auditId,
  contained = false,
  control,
  matrix,
  mode,
  onClose,
  onMatrixUpdated,
  panelClassName = "top-4 right-4 h-[calc(100dvh-2rem)] max-w-[78rem] overflow-y-auto rounded-[24px] border border-black/5 bg-[#f8f6f1] sm:p-6",
}: TestingMatrixDetailPanelProps) {
  const { showNotification } = useNotification();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<ControlTestingMatrix>(() => matrix ?? buildEmptyTestingMatrix(control, auditId));
  const canPersist = mode === "live" && Boolean(auditId);

  useEffect(() => {
    setDraft(matrix ?? buildEmptyTestingMatrix(control, auditId));
  }, [auditId, control, matrix]);

  const resultLookup = useMemo(() => {
    return draft.results.reduce<Record<string, TestingMatrixAttributeResult>>((lookup, result) => {
      lookup[`${result.sampleId}:${result.attributeId}`] = result.result;
      return lookup;
    }, {});
  }, [draft.results]);

  const content = (
    <div className="grid gap-5">
      <section className="rounded-[24px] border border-black/5 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Testing matrix header</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Capture the population, sample, and overall conclusion for attribute testing on this control.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FilePenLine size={15} />
            {isPending ? "Saving..." : "Save matrix"}
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <EditorField label="Title" value={draft.title} onChange={(value) => setDraft((current) => ({ ...current, title: value }))} />
          <EditorNumberField
            label="Population size"
            value={draft.populationSize}
            onChange={(value) => setDraft((current) => ({ ...current, populationSize: value }))}
          />
          <EditorAreaField
            className="md:col-span-2"
            label="Population description"
            value={draft.populationDescription}
            onChange={(value) => setDraft((current) => ({ ...current, populationDescription: value }))}
          />
          <EditorNumberField
            label="Sample size"
            value={draft.sampleSize}
            onChange={(value) => setDraft((current) => ({ ...current, sampleSize: value }))}
          />
          <div className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Last update</span>
            <div className="rounded-[16px] border border-black/5 bg-[#fcfbf8] px-3.5 py-2.5 text-[13px] text-[var(--foreground)]">
              {draft.updatedAt ? formatDateTime(draft.updatedAt) : "Not saved yet"}
            </div>
          </div>
          <EditorAreaField
            className="md:col-span-2"
            label="Sample description / rationale"
            value={draft.sampleDescription}
            onChange={(value) => setDraft((current) => ({ ...current, sampleDescription: value }))}
          />
          <EditorAreaField
            className="md:col-span-2"
            label="Conclusion"
            value={draft.conclusion}
            onChange={(value) => setDraft((current) => ({ ...current, conclusion: value }))}
          />
        </div>
      </section>

      <section className="rounded-[24px] border border-black/5 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Attributes</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Define the yes/no checks applied to each sample item.</p>
          </div>
          <button
            type="button"
            onClick={handleAddAttribute}
            className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-1.5 text-[11px] font-semibold text-[var(--brand-indigo-core)]"
          >
            <Plus size={14} />
            Add attribute
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          {draft.attributes.map((attribute) => (
            <div key={attribute.id} className="grid gap-3 rounded-[18px] bg-[var(--surface-tint)] p-3.5 md:grid-cols-[1.2fr_1fr_auto]">
              <EditorField
                label="Attribute label"
                value={attribute.label}
                onChange={(value) => {
                  setDraft((current) => ({
                    ...current,
                    attributes: current.attributes.map((item) => (item.id === attribute.id ? { ...item, label: value } : item)),
                  }));
                }}
              />
              <EditorField
                label="Guidance"
                value={attribute.guidance}
                onChange={(value) => {
                  setDraft((current) => ({
                    ...current,
                    attributes: current.attributes.map((item) => (item.id === attribute.id ? { ...item, guidance: value } : item)),
                  }));
                }}
              />
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => handleRemoveAttribute(attribute.id)}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-black/5 bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-black/5 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Sample testing</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Evaluate each attribute for every sample item. Use `Exception noted` to summarize any failed attribute on the row.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddSample}
            className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-1.5 text-[11px] font-semibold text-[var(--brand-indigo-core)]"
          >
            <Plus size={14} />
            Add sample row
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead className="sticky top-0 z-10 bg-[#f8f6f1]">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                <th className="px-3 py-2">Sample</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Source Ref</th>
                {draft.attributes.map((attribute) => (
                  <th key={attribute.id} className="px-3 py-2 min-w-[12rem]">
                    {attribute.label || "Untitled attribute"}
                  </th>
                ))}
                <th className="px-3 py-2 min-w-[16rem]">Exception noted</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {draft.samples.map((sample) => (
                <tr key={sample.id} className="bg-[#fcfbf8] shadow-[0_10px_24px_rgba(1,30,65,0.06)]">
                  <td className="rounded-l-[18px] px-3 py-3 align-top">
                    <input
                      value={sample.sampleIdentifier}
                      onChange={(event) => updateSample(sample.id, { sampleIdentifier: event.target.value })}
                      className="w-full rounded-[14px] border border-black/5 bg-white px-3 py-2 text-[13px] outline-none"
                    />
                  </td>
                  <td className="px-3 py-3 align-top">
                    <textarea
                      value={sample.sampleDescription}
                      onChange={(event) => updateSample(sample.id, { sampleDescription: event.target.value })}
                      rows={3}
                      className="w-full resize-none rounded-[14px] border border-black/5 bg-white px-3 py-2 text-[13px] outline-none"
                    />
                  </td>
                  <td className="px-3 py-3 align-top">
                    <textarea
                      value={sample.sourceReference}
                      onChange={(event) => updateSample(sample.id, { sourceReference: event.target.value })}
                      rows={3}
                      className="w-full resize-none rounded-[14px] border border-black/5 bg-white px-3 py-2 text-[13px] outline-none"
                    />
                  </td>
                  {draft.attributes.map((attribute) => {
                    const result = resultLookup[`${sample.id}:${attribute.id}`] ?? "NOT_TESTED";

                    return (
                      <td key={`${sample.id}:${attribute.id}`} className="px-3 py-3 align-top">
                        <select
                          value={result}
                          onChange={(event) => updateResult(sample.id, attribute.id, event.target.value as TestingMatrixAttributeResult)}
                          className={cn(
                            "w-full rounded-[14px] border px-3 py-2 text-[13px] outline-none",
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
                  <td className="px-3 py-3 align-top">
                    <textarea
                      value={sample.exceptionNoted}
                      onChange={(event) => updateSample(sample.id, { exceptionNoted: event.target.value })}
                      rows={3}
                      className="w-full resize-none rounded-[14px] border border-black/5 bg-white px-3 py-2 text-[13px] outline-none"
                    />
                  </td>
                  <td className="rounded-r-[18px] px-3 py-3 align-top">
                    <button
                      type="button"
                      onClick={() => handleRemoveSample(sample.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-1.5 text-[11px] font-semibold text-[var(--muted)]"
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
      </section>
    </div>
  );

  if (contained) {
    return (
      <>
        <button
          type="button"
          aria-label="Close testing matrix detail"
          onClick={onClose}
          className="absolute inset-0 z-30 bg-[rgba(1,30,65,0.18)] backdrop-blur-[1px]"
        />
        <aside className="absolute inset-y-0 right-0 z-40 flex w-full max-w-[78rem] flex-col overflow-hidden border-l border-black/5 bg-[#f8f6f1] p-6 shadow-[-24px_0_60px_rgba(1,30,65,0.12)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Testing matrix</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">{draft.title}</h2>
              <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
                Attribute testing stays in the dashboard so sample-level pass/fail results and exception notes can be updated in one place.
              </p>
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
      title={draft.title}
      subtitle="Attribute testing stays in the dashboard so sample-level results and exception notes can be updated in one place."
      open={Boolean(draft)}
      onClose={onClose}
      panelClassName={panelClassName}
    >
      {content}
    </DetailPanel>
  );

  function updateSample(sampleId: string, next: Partial<ControlTestingMatrixSample>) {
    setDraft((current) => ({
      ...current,
      samples: current.samples.map((sample) => (sample.id === sampleId ? { ...sample, ...next } : sample)),
    }));
  }

  function updateResult(sampleId: string, attributeId: string, value: TestingMatrixAttributeResult) {
    setDraft((current) => {
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
    setDraft((current) => {
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
    setDraft((current) => ({
      ...current,
      attributes: current.attributes
        .filter((attribute) => attribute.id !== attributeId)
        .map((attribute, index) => ({ ...attribute, displayOrder: index + 1 })),
      results: current.results.filter((result) => result.attributeId !== attributeId),
    }));
  }

  function handleAddSample() {
    setDraft((current) => {
      const sampleId = buildClientId("sample");
      const nextSample: ControlTestingMatrixSample = {
        id: sampleId,
        matrixId: current.id,
        sampleIdentifier: `S-${String(current.samples.length + 1).padStart(2, "0")}`,
        sampleDescription: "",
        sourceReference: "",
        exceptionNoted: "",
        displayOrder: current.samples.length + 1,
      };

      return {
        ...current,
        samples: [...current.samples, nextSample],
        results: [
          ...current.results,
          ...current.attributes.map<ControlTestingMatrixResult>((attribute) => ({
            id: "",
            matrixId: current.id,
            sampleId,
            attributeId: attribute.id,
            result: "NOT_TESTED",
          })),
        ],
      };
    });
  }

  function handleRemoveSample(sampleId: string) {
    setDraft((current) => ({
      ...current,
      samples: current.samples
        .filter((sample) => sample.id !== sampleId)
        .map((sample, index) => ({ ...sample, displayOrder: index + 1 })),
      results: current.results.filter((result) => result.sampleId !== sampleId),
    }));
  }

  function handleSave() {
    const normalizedDraft = {
      ...draft,
      updatedAt: new Date().toISOString(),
      attributes: draft.attributes.map((attribute, index) => ({
        ...attribute,
        displayOrder: index + 1,
      })),
      samples: draft.samples.map((sample, index) => ({
        ...sample,
        displayOrder: index + 1,
      })),
    };

    if (!canPersist || !auditId) {
      onMatrixUpdated(normalizedDraft);
      showNotification({
        title: "Matrix saved",
        message: "The prototype testing matrix was updated in local state.",
        tone: "success",
      });
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/controls/${control.id}/testing-matrix`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            auditId,
            matrix: {
              title: normalizedDraft.title,
              populationDescription: normalizedDraft.populationDescription,
              populationSize: normalizedDraft.populationSize ?? null,
              sampleDescription: normalizedDraft.sampleDescription,
              sampleSize: normalizedDraft.sampleSize ?? null,
              conclusion: normalizedDraft.conclusion,
              attributes: normalizedDraft.attributes.map((attribute) => ({
                id: isPersistedId(attribute.id) ? attribute.id : undefined,
                attributeKey: attribute.attributeKey,
                label: attribute.label,
                guidance: attribute.guidance,
                displayOrder: attribute.displayOrder,
              })),
              samples: normalizedDraft.samples.map((sample) => ({
                id: isPersistedId(sample.id) ? sample.id : undefined,
                sampleIdentifier: sample.sampleIdentifier,
                sampleDescription: sample.sampleDescription,
                sourceReference: sample.sourceReference,
                exceptionNoted: sample.exceptionNoted,
                displayOrder: sample.displayOrder,
              })),
              results: normalizedDraft.results.map((result) => ({
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

        setDraft(result.matrix);
        onMatrixUpdated(result.matrix);
        showNotification({
          title: "Matrix saved",
          message: "The testing matrix was saved in the app.",
          tone: "success",
        });
      } catch (error) {
        showNotification({
          title: "Save failed",
          message: error instanceof Error ? error.message : "There was an error saving the testing matrix.",
          tone: "error",
        });
      }
    });
  }
}

function EditorField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-[16px] border border-black/5 bg-[#fcfbf8] px-3.5 py-2.5 text-[13px] outline-none"
      />
    </label>
  );
}

function EditorNumberField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number | undefined) => void;
  value?: number;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</span>
      <input
        type="number"
        min="0"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
        className="rounded-[16px] border border-black/5 bg-[#fcfbf8] px-3.5 py-2.5 text-[13px] outline-none"
      />
    </label>
  );
}

function EditorAreaField({
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
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="resize-none rounded-[16px] border border-black/5 bg-[#fcfbf8] px-3.5 py-2.5 text-[13px] outline-none"
      />
    </label>
  );
}

function buildEmptyTestingMatrix(control: Control, auditId: string | null): ControlTestingMatrix {
  const matrixId = buildClientId("matrix");
  const attributes: ControlTestingMatrixAttribute[] = [
    {
      id: buildClientId("attribute"),
      matrixId,
      attributeKey: "attribute_1",
      label: "Was the control executed?",
      guidance: "Confirm the control operated for the sampled item.",
      displayOrder: 1,
    },
    {
      id: buildClientId("attribute"),
      matrixId,
      attributeKey: "attribute_2",
      label: "Was the control performed timely?",
      guidance: "Validate the control was completed within required timing.",
      displayOrder: 2,
    },
  ];
  const samples: ControlTestingMatrixSample[] = [
    {
      id: buildClientId("sample"),
      matrixId,
      sampleIdentifier: "S-01",
      sampleDescription: "",
      sourceReference: "",
      exceptionNoted: "",
      displayOrder: 1,
    },
  ];

  return {
    id: matrixId,
    auditId: auditId ?? "",
    controlId: control.id,
    title: `${control.name} Testing Matrix`,
    populationDescription: `Population includes all items subject to ${control.name} during the audit period.`,
    populationSize: undefined,
    sampleDescription: "Selected a representative sample for attribute testing.",
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

function buildClientId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function isPersistedId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
