"use client";

import { useState } from "react";
import { Wand2 } from "lucide-react";

import { generateSample, parseReferenceList, type SampleGenerationResult, type SamplingMethod } from "@/lib/sampling";

const methodOptions: Array<{ value: SamplingMethod; label: string }> = [
  { value: "random", label: "Random" },
  { value: "systematic", label: "Systematic" },
  { value: "judgmental", label: "Judgmental" },
];

export function SampleGenerator({
  defaultPopulationSize,
  disabled = false,
  onApply,
}: {
  defaultPopulationSize?: number;
  disabled?: boolean;
  onApply: (result: SampleGenerationResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<SamplingMethod>("random");
  const [sampleSize, setSampleSize] = useState(25);
  const [populationSize, setPopulationSize] = useState<number | undefined>(defaultPopulationSize);
  const [referencesRaw, setReferencesRaw] = useState("");
  const [seedRaw, setSeedRaw] = useState("");
  const [error, setError] = useState("");

  function handleGenerate() {
    const references = parseReferenceList(referencesRaw);
    const effectivePopulation = references.length > 0 ? references.length : populationSize ?? 0;

    if (effectivePopulation <= 0) {
      setError("Enter a population size or paste a reference list before generating.");
      return;
    }

    if (sampleSize <= 0) {
      setError("Enter a sample size of at least 1.");
      return;
    }

    const seed = seedRaw.trim().length > 0 ? Number(seedRaw.trim()) : undefined;
    const result = generateSample({ method, sampleSize, populationSize, references, seed });

    if (result.items.length === 0) {
      setError("No sample items could be generated from the provided inputs.");
      return;
    }

    setError("");
    setSeedRaw(String(result.seed));
    onApply(result);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-sm border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Wand2 size={14} />
        Auto-generate sample
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-[22rem] border border-black/10 bg-white p-4 shadow-[0_18px_44px_rgba(1,30,65,0.18)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Automated sampling</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Generates sample rows and documents the methodology. This replaces the current sample rows.</p>

          <div className="mt-3 grid gap-3">
            <label className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Method</span>
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value as SamplingMethod)}
                className="border border-black/10 bg-[#fffdfa] px-2 py-2 text-[13px] outline-none"
              >
                {methodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Sample size</span>
                <input
                  type="number"
                  min="1"
                  value={sampleSize}
                  onChange={(event) => setSampleSize(Number(event.target.value))}
                  className="border border-black/10 bg-[#fffdfa] px-2 py-2 text-[13px] outline-none"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Population size</span>
                <input
                  type="number"
                  min="0"
                  value={populationSize ?? ""}
                  onChange={(event) => setPopulationSize(event.target.value === "" ? undefined : Number(event.target.value))}
                  className="border border-black/10 bg-[#fffdfa] px-2 py-2 text-[13px] outline-none"
                />
              </label>
            </div>

            <label className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Reference list (optional)</span>
              <textarea
                value={referencesRaw}
                onChange={(event) => setReferencesRaw(event.target.value)}
                rows={3}
                placeholder="Paste IDs separated by commas or new lines to sample from real values."
                className="resize-none border border-black/10 bg-[#fffdfa] px-2 py-2 text-[13px] leading-5 outline-none"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Seed (optional, for reproducibility)</span>
              <input
                value={seedRaw}
                onChange={(event) => setSeedRaw(event.target.value)}
                placeholder="Leave blank to auto-generate"
                className="border border-black/10 bg-[#fffdfa] px-2 py-2 text-[13px] outline-none"
              />
            </label>

            {error ? <p className="text-xs text-[var(--brand-coral)]">{error}</p> : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-sm border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                className="rounded-sm bg-[var(--brand-indigo-core)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
              >
                Generate sample
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
