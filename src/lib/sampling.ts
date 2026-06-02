export type SamplingMethod = "random" | "systematic" | "judgmental";

export type GeneratedSampleItem = {
  sampleIdentifier: string;
  sampleDescription: string;
  sourceReference: string;
};

export type SampleGenerationResult = {
  items: GeneratedSampleItem[];
  methodology: string;
  seed: number;
  sampleSize: number;
  populationSize: number;
};

const methodLabels: Record<SamplingMethod, string> = {
  random: "Random sampling",
  systematic: "Systematic sampling",
  judgmental: "Judgmental (haphazard) sampling",
};

// Small deterministic PRNG so a given seed reproduces the same selection.
function mulberry32(seed: number) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function parseReferenceList(raw: string): string[] {
  return raw
    .split(/[\n,;\t]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function shuffleIndices(count: number, rng: () => number) {
  const indices = Array.from({ length: count }, (_, index) => index + 1);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

/**
 * Generate sample items for a testing matrix using random, systematic, or
 * judgmental selection. When a reference list is supplied, items are drawn from
 * those actual values; otherwise numbered population references are generated.
 */
export function generateSample(input: {
  method: SamplingMethod;
  sampleSize: number;
  populationSize?: number;
  references?: string[];
  seed?: number;
}): SampleGenerationResult {
  const references = input.references ?? [];
  const hasReferences = references.length > 0;
  const effectivePopulation = hasReferences ? references.length : Math.max(0, Math.floor(input.populationSize ?? 0));
  const requestedSize = Math.max(0, Math.floor(input.sampleSize));
  const sampleSize = Math.min(requestedSize, effectivePopulation > 0 ? effectivePopulation : requestedSize);
  const seed = input.seed && input.seed > 0 ? Math.floor(input.seed) : Math.floor((Math.random() * 1_000_000_000) + 1);
  const rng = mulberry32(seed);

  if (effectivePopulation <= 0 || sampleSize <= 0) {
    return {
      items: [],
      methodology: "Provide a population size (or reference list) and a sample size to generate a sample.",
      seed,
      sampleSize: 0,
      populationSize: effectivePopulation,
    };
  }

  let chosen: number[] = [];
  let systematicStart = 0;
  let interval = 0;

  if (input.method === "random") {
    chosen = shuffleIndices(effectivePopulation, rng).slice(0, sampleSize).sort((a, b) => a - b);
  } else if (input.method === "systematic") {
    interval = Math.max(1, Math.floor(effectivePopulation / sampleSize));
    systematicStart = 1 + Math.floor(rng() * interval);
    const picked = new Set<number>();
    let cursor = systematicStart;
    while (picked.size < sampleSize) {
      const value = ((cursor - 1) % effectivePopulation) + 1;
      if (!picked.has(value)) {
        picked.add(value);
      }
      cursor += interval;
      // Guard against an interval that can't reach new items.
      if (cursor > effectivePopulation * 2 && picked.size < sampleSize) {
        for (let candidate = 1; candidate <= effectivePopulation && picked.size < sampleSize; candidate += 1) {
          picked.add(candidate);
        }
        break;
      }
    }
    chosen = Array.from(picked).sort((a, b) => a - b);
  } else {
    // Judgmental / haphazard: spread selections across the population.
    const step = effectivePopulation / sampleSize;
    const picked = new Set<number>();
    for (let i = 0; i < sampleSize; i += 1) {
      picked.add(Math.min(effectivePopulation, Math.max(1, Math.round(i * step) + 1)));
    }
    let filler = 1;
    while (picked.size < sampleSize && filler <= effectivePopulation) {
      picked.add(filler);
      filler += 1;
    }
    chosen = Array.from(picked).sort((a, b) => a - b);
  }

  const items: GeneratedSampleItem[] = chosen.map((populationIndex, position) => {
    const sourceReference = hasReferences ? references[populationIndex - 1] : `Population reference ${pad(populationIndex)}`;
    return {
      sampleIdentifier: `S-${pad(position + 1)}`,
      sampleDescription: `Sample item ${pad(position + 1)} selected via ${input.method} sampling (population position ${populationIndex} of ${effectivePopulation}).`,
      sourceReference,
    };
  });

  const methodologyLines = [
    `${methodLabels[input.method]} applied on ${new Date().toISOString().slice(0, 10)}.`,
    `Population: ${effectivePopulation}${hasReferences ? " items from the supplied reference list" : " (from population size)"}. Sample size: ${items.length}.`,
  ];

  if (input.method === "random") {
    methodologyLines.push(`Selection: pseudo-random using reproducible seed ${seed}.`);
  } else if (input.method === "systematic") {
    methodologyLines.push(`Selection: every ${interval}th item from random start ${systematicStart} (seed ${seed}).`);
  } else {
    methodologyLines.push("Selection: haphazard coverage across the population based on auditor judgment (not statistically derived).");
  }

  return {
    items,
    methodology: methodologyLines.join(" "),
    seed,
    sampleSize: items.length,
    populationSize: effectivePopulation,
  };
}
