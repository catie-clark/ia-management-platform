import type {
  AuditDocument,
  ControlTestingMatrix,
  TestingMatrixAttributeResult,
  WorkpaperContent,
} from "@/types/audit";

const emptyWorkpaperContent: WorkpaperContent = {
  controlReference: "",
  keyControl: "",
  typeOfControl: "",
  controlFrequency: "",
  assertions: "",
  descriptionOfTestToBePerformed: "",
  totalPopulationAndSamplingUnits: "",
  populationCompletenessConsideration: "",
  sampleSizeAndSelectionProcedures: "",
  expectedDeviationTypes: "",
  documentationOfTesting: "",
  extensionOfInterimTestingToEndOfPeriod: "",
  matrixExceptionSummary: "",
  numberOfDeviationsDetected: "0",
  deviationDescriptionAndCause: "",
  didDeviationsResultFromFraudOrError: "",
  wereDeviationsIsolatedOrPervasive: "",
  finalNumberOfDeviations: "0",
  controlEffectivenessConclusion: "",
};

export function getEmptyWorkpaperContent(): WorkpaperContent {
  return { ...emptyWorkpaperContent };
}

export function readWorkpaperContent(
  payload: Record<string, unknown>,
  previewSections?: AuditDocument["previewSections"],
): WorkpaperContent | undefined {
  const candidate = payload.workpaper_content;

  if (candidate && typeof candidate === "object") {
    const raw = candidate as Record<string, unknown>;

    // Support legacy workpapers by mapping the prior narrative fields into the new structure.
    if ("objective" in raw || "scope" in raw || "procedures" in raw || "results" in raw || "conclusion" in raw) {
      return {
        ...getEmptyWorkpaperContent(),
        keyControl: readText(raw.summary),
        descriptionOfTestToBePerformed: readText(raw.procedures),
        totalPopulationAndSamplingUnits: readText(raw.scope),
        documentationOfTesting: readText(raw.results),
        controlEffectivenessConclusion: readText(raw.conclusion),
      };
    }

    return {
      controlReference: readText(raw.control_reference),
      keyControl: readText(raw.key_control),
      typeOfControl: readText(raw.type_of_control),
      controlFrequency: readText(raw.control_frequency),
      assertions: readText(raw.assertions),
      descriptionOfTestToBePerformed: readText(raw.description_of_test_to_be_performed),
      totalPopulationAndSamplingUnits: readText(raw.total_population_and_sampling_units),
      populationCompletenessConsideration: readText(raw.population_completeness_consideration),
      sampleSizeAndSelectionProcedures: readText(raw.sample_size_and_selection_procedures),
      expectedDeviationTypes: readText(raw.expected_deviation_types),
      documentationOfTesting: readText(raw.documentation_of_testing),
      extensionOfInterimTestingToEndOfPeriod: readText(raw.extension_of_interim_testing_to_end_of_period),
      matrixExceptionSummary: readText(raw.matrix_exception_summary),
      numberOfDeviationsDetected: readText(raw.number_of_deviations_detected) || "0",
      deviationDescriptionAndCause: readText(raw.deviation_description_and_cause),
      didDeviationsResultFromFraudOrError: readText(raw.did_deviations_result_from_fraud_or_error),
      wereDeviationsIsolatedOrPervasive: readText(raw.were_deviations_isolated_or_pervasive),
      finalNumberOfDeviations: readText(raw.final_number_of_deviations) || "0",
      controlEffectivenessConclusion: readText(raw.control_effectiveness_conclusion),
    };
  }

  if (!previewSections || previewSections.length === 0) {
    return undefined;
  }

  const sectionMap = new Map(
    previewSections.map((section) => [normalizeHeading(section.heading), section.body.join("\n\n")]),
  );

  return {
    ...getEmptyWorkpaperContent(),
    descriptionOfTestToBePerformed: sectionMap.get("testing approach") ?? "",
    totalPopulationAndSamplingUnits: sectionMap.get("population and sampling") ?? "",
    documentationOfTesting: sectionMap.get("documentation of testing") ?? "",
    deviationDescriptionAndCause: sectionMap.get("deviations") ?? "",
    controlEffectivenessConclusion: sectionMap.get("conclusion") ?? "",
  };
}

export function buildWorkpaperPreview(content: WorkpaperContent) {
  const previewSections = [
    buildSection(
      "Control Metadata",
      [
        buildLine("Control Reference", content.controlReference),
        buildLine("Key Control", content.keyControl),
        buildLine("Type of Control", content.typeOfControl),
        buildLine("Control Frequency", content.controlFrequency),
        buildLine("Assertion(s)", content.assertions),
      ].filter(Boolean).join("\n\n"),
    ),
    buildSection("Testing Approach", content.descriptionOfTestToBePerformed),
    buildSection(
      "Population and Sampling",
      [
        buildLine("Define Total Population and Sampling Units", content.totalPopulationAndSamplingUnits),
        buildLine(
          "Document how completeness of the population was considered",
          content.populationCompletenessConsideration,
        ),
        buildLine("Sample Size and Selection Procedures", content.sampleSizeAndSelectionProcedures),
        buildLine("Define Expected Deviation Types", content.expectedDeviationTypes),
      ]
        .filter(Boolean)
        .join("\n\n"),
    ),
    buildSection(
      "Documentation of Testing",
      [
        buildLine("Documentation of Testing", content.documentationOfTesting),
        buildLine(
          "Extension of Interim Testing to End of Period",
          content.extensionOfInterimTestingToEndOfPeriod,
        ),
      ]
        .filter(Boolean)
        .join("\n\n"),
    ),
    buildSection(
      "Deviations",
      [
        buildLine("Matrix Exceptions", content.matrixExceptionSummary),
        buildLine("Number of Deviations Detected", content.numberOfDeviationsDetected),
        buildLine("Description of deviations noted and their cause", content.deviationDescriptionAndCause),
        buildLine("Did the deviations result from fraud or error?", content.didDeviationsResultFromFraudOrError),
        buildLine(
          "Were the deviations isolated or pervasive?",
          content.wereDeviationsIsolatedOrPervasive,
        ),
        buildLine("Final number of deviations", content.finalNumberOfDeviations),
      ]
        .filter(Boolean)
        .join("\n\n"),
    ),
    buildSection("Conclusion", content.controlEffectivenessConclusion),
  ].filter((section): section is { heading: string; body: string[] } => section !== null);

  return {
    previewSummary:
      content.controlReference.trim() ||
      content.keyControl.trim() ||
      firstParagraph(content.descriptionOfTestToBePerformed) ||
      "Testing workpaper prepared in the platform.",
    previewSections,
  };
}

export function serializeWorkpaperContent(content: WorkpaperContent) {
  return {
    control_reference: content.controlReference,
    key_control: content.keyControl,
    type_of_control: content.typeOfControl,
    control_frequency: content.controlFrequency,
    assertions: content.assertions,
    description_of_test_to_be_performed: content.descriptionOfTestToBePerformed,
    total_population_and_sampling_units: content.totalPopulationAndSamplingUnits,
    population_completeness_consideration: content.populationCompletenessConsideration,
    sample_size_and_selection_procedures: content.sampleSizeAndSelectionProcedures,
    expected_deviation_types: content.expectedDeviationTypes,
    documentation_of_testing: content.documentationOfTesting,
    extension_of_interim_testing_to_end_of_period: content.extensionOfInterimTestingToEndOfPeriod,
    matrix_exception_summary: content.matrixExceptionSummary,
    number_of_deviations_detected: content.numberOfDeviationsDetected,
    deviation_description_and_cause: content.deviationDescriptionAndCause,
    did_deviations_result_from_fraud_or_error: content.didDeviationsResultFromFraudOrError,
    were_deviations_isolated_or_pervasive: content.wereDeviationsIsolatedOrPervasive,
    final_number_of_deviations: content.finalNumberOfDeviations,
    control_effectiveness_conclusion: content.controlEffectivenessConclusion,
  };
}

export function buildMatrixExceptionSync(matrix: ControlTestingMatrix) {
  const failedCellBySampleId = new Map<string, string[]>();

  for (const result of matrix.results) {
    if (result.result !== "FAIL") {
      continue;
    }

    const attribute = matrix.attributes.find((candidate) => candidate.id === result.attributeId);
    const entry = failedCellBySampleId.get(result.sampleId) ?? [];
    entry.push(attribute?.label ?? "Failed attribute");
    failedCellBySampleId.set(result.sampleId, entry);
  }

  const summaryLines = matrix.samples.flatMap((sample) => {
    const failedAttributes = failedCellBySampleId.get(sample.id) ?? [];
    const hasException = sample.exceptionNoted.trim().length > 0 || failedAttributes.length > 0;

    if (!hasException) {
      return [];
    }

    const parts = [
      sample.sampleIdentifier.trim() || sample.id,
      sample.exceptionNoted.trim() || "Exception recorded in testing matrix.",
    ];

    if (failedAttributes.length > 0) {
      parts.push(`Failed attributes: ${failedAttributes.join("; ")}`);
    }

    return [parts.join(" - ")];
  });

  return {
    matrixExceptionCount: String(summaryLines.length),
    matrixExceptionSummary:
      summaryLines.length > 0
        ? summaryLines.join("\n")
        : "No exceptions have been recorded in the testing matrix.",
  };
}

export function deriveTypeOfControlFromRcm(args: {
  automatedManual?: string | null;
  controlRating?: string | null;
  keyVsNonKey?: string | null;
  preventiveDetective?: string | null;
}) {
  return [args.keyVsNonKey, args.preventiveDetective, args.automatedManual, args.controlRating]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" | ");
}

function buildSection(heading: string, value: string) {
  const paragraphs = value
    .split(/\r?\n\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return null;
  }

  return {
    heading,
    body: paragraphs,
  };
}

function buildLine(label: string, value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? `${label}: ${trimmed}` : "";
}

function firstParagraph(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find(Boolean) ?? "";
}

function readText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeHeading(value: string) {
  return value.trim().toLowerCase();
}

export function hasFailResult(value: TestingMatrixAttributeResult) {
  return value === "FAIL";
}
