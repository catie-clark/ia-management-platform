import type { ControlTestingMatrix } from "@/types/audit";

export type MatrixResultSummary = {
  matrixCount: number;
  sampleCount: number;
  attributeCount: number;
  passCount: number;
  failCount: number;
  notTestedCount: number;
  exceptionCount: number;
  exceptions: Array<{ sample: string; note: string; matrixTitle: string }>;
  perMatrix: Array<{
    title: string;
    populationDescription: string;
    samples: number;
    pass: number;
    fail: number;
    notTested: number;
  }>;
};

export const TEST_RESULT_NARRATIVE_SYSTEM = [
  "You are an experienced internal audit senior drafting the results narrative for a control test workpaper.",
  "Write in a precise, objective, audit-appropriate tone. Be concise and factual.",
  "Ground every statement in the testing results provided — do not invent sample details, counts, or evidence.",
  "Structure the narrative as: (1) what was tested and the population/sample basis, (2) the results including any exceptions, (3) a clear conclusion on control operating effectiveness.",
  "If exceptions were noted, describe them factually and state the implication for the control conclusion. If no exceptions were noted, conclude the control operated effectively for the period tested.",
  "Output plain prose suitable to paste directly into a workpaper conclusion. Do not include headings, markdown, or a preamble such as 'Here is'.",
].join(" ");

export function summarizeControlMatrices(matrices: ControlTestingMatrix[]): MatrixResultSummary {
  let passCount = 0;
  let failCount = 0;
  let notTestedCount = 0;
  const exceptions: MatrixResultSummary["exceptions"] = [];
  const perMatrix: MatrixResultSummary["perMatrix"] = [];
  let sampleCount = 0;
  let attributeCount = 0;

  for (const matrix of matrices) {
    let matrixPass = 0;
    let matrixFail = 0;
    let matrixNotTested = 0;

    for (const result of matrix.results) {
      if (result.result === "PASS") matrixPass += 1;
      else if (result.result === "FAIL") matrixFail += 1;
      else matrixNotTested += 1;
    }

    for (const sample of matrix.samples) {
      if (sample.exceptionNoted.trim().length > 0) {
        exceptions.push({ sample: sample.sampleIdentifier, note: sample.exceptionNoted.trim(), matrixTitle: matrix.title });
      }
    }

    sampleCount += matrix.samples.length;
    attributeCount += matrix.attributes.length;
    passCount += matrixPass;
    failCount += matrixFail;
    notTestedCount += matrixNotTested;

    perMatrix.push({
      title: matrix.title,
      populationDescription: matrix.populationDescription,
      samples: matrix.samples.length,
      pass: matrixPass,
      fail: matrixFail,
      notTested: matrixNotTested,
    });
  }

  return {
    matrixCount: matrices.length,
    sampleCount,
    attributeCount,
    passCount,
    failCount,
    notTestedCount,
    exceptionCount: exceptions.length,
    exceptions,
    perMatrix,
  };
}

export function buildNarrativePrompt({
  controlLabel,
  controlName,
  controlDescription,
  summary,
}: {
  controlLabel: string;
  controlName: string;
  controlDescription?: string;
  summary: MatrixResultSummary;
}): string {
  const lines: string[] = [];
  lines.push(`Control: ${controlLabel} - ${controlName}`);
  if (controlDescription) {
    lines.push(`Control description: ${controlDescription}`);
  }
  lines.push("");
  lines.push("Testing results:");
  lines.push(
    `- ${summary.sampleCount} sample item(s) tested across ${summary.matrixCount} testing matrix/matrices and ${summary.attributeCount} attribute(s).`,
  );
  lines.push(`- Attribute results: ${summary.passCount} pass, ${summary.failCount} fail, ${summary.notTestedCount} not tested.`);

  for (const matrix of summary.perMatrix) {
    lines.push(
      `- Matrix "${matrix.title}": ${matrix.samples} samples (${matrix.pass} pass / ${matrix.fail} fail / ${matrix.notTested} not tested). Population: ${matrix.populationDescription || "not documented"}.`,
    );
  }

  if (summary.exceptions.length > 0) {
    lines.push("");
    lines.push("Exceptions noted:");
    for (const exception of summary.exceptions) {
      lines.push(`- [${exception.matrixTitle} | ${exception.sample}] ${exception.note}`);
    }
  } else {
    lines.push("");
    lines.push("No exceptions were noted across the tested samples.");
  }

  lines.push("");
  lines.push("Draft the test result narrative and operating-effectiveness conclusion based strictly on the above.");
  return lines.join("\n");
}

/**
 * Deterministic fallback narrative used when the Claude API key is not configured.
 */
export function buildTemplateNarrative({
  controlName,
  summary,
}: {
  controlName: string;
  summary: MatrixResultSummary;
}): string {
  const testedAttributes = summary.passCount + summary.failCount;
  const coverage =
    summary.sampleCount > 0
      ? `${summary.sampleCount} sample item(s) were selected and tested across ${summary.attributeCount} attribute(s).`
      : "No sample items have been recorded for this control test.";

  const resultSentence =
    testedAttributes === 0
      ? "Testing has not yet been completed for the selected samples."
      : summary.failCount === 0
        ? `All ${summary.passCount} tested attribute results passed, with no exceptions identified.`
        : `${summary.passCount} attribute results passed and ${summary.failCount} failed.`;

  const exceptionSentence =
    summary.exceptionCount === 0
      ? "No exceptions were noted during testing."
      : `${summary.exceptionCount} exception(s) were noted: ${summary.exceptions
          .map((exception) => `${exception.sample} - ${exception.note}`)
          .join("; ")}.`;

  const conclusionSentence =
    summary.failCount === 0 && summary.exceptionCount === 0 && testedAttributes > 0
      ? `Based on the results, ${controlName} operated effectively for the period tested.`
      : testedAttributes === 0
        ? `A conclusion on the operating effectiveness of ${controlName} cannot be reached until testing is complete.`
        : `The exceptions identified indicate that ${controlName} did not operate effectively in all instances and require follow-up and disposition.`;

  return [
    `Testing of ${controlName} was performed to evaluate operating effectiveness. ${coverage}`,
    `${resultSentence} ${exceptionSentence}`,
    conclusionSentence,
  ].join(" ");
}
