import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  type ControlTestingMatrixAttributeRow,
  type ControlTestingMatrixResultRow,
  type ControlTestingMatrixRow,
  type ControlTestingMatrixSampleRow,
  mapControlTestingMatrix,
  mapControlTestingMatrixAttribute,
  mapControlTestingMatrixResult,
  mapControlTestingMatrixSample,
} from "@/lib/live-audit";
import type {
  ControlTestingMatrix,
  ControlTestingMatrixAttribute,
  ControlTestingMatrixResult,
  ControlTestingMatrixSample,
  TestingMatrixAttributeResult,
} from "@/types/audit";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type ControlRcmPayloadRow = {
  id: string;
  source_payload: Record<string, unknown> | null;
};

type SaveTestingMatrixInput = {
  auditId: string;
  controlId: string;
  testedByUserId?: string;
  matrix: {
    id?: string;
    displayOrder?: number;
    title: string;
    populationDescription: string;
    populationSize?: number;
    sampleDescription: string;
    sampleSize?: number;
    budgetedHours?: number | null;
    conclusion: string;
    attributes: Array<{
      clientId?: string;
      id?: string;
      attributeKey?: string;
      label: string;
      guidance: string;
      displayOrder: number;
    }>;
    samples: Array<{
      clientId?: string;
      id?: string;
      sampleIdentifier: string;
      sampleDescription: string;
      sourceReference: string;
      exceptionNoted: string;
      displayOrder: number;
      timeSpentMinutes?: number | null;
    }>;
    results: Array<{
      id?: string;
      sampleId: string;
      attributeId: string;
      result: TestingMatrixAttributeResult;
    }>;
  };
};

export async function loadAuditControlTestingMatrices(supabase: SupabaseAdminClient, auditId: string) {
  const [matricesResult, attributesResult, samplesResult, resultsResult, controlsResult] = await Promise.all([
    supabase
      .from("control_testing_matrices")
      .select("id, audit_id, control_id, display_order, title, population_description, population_size, sample_description, sample_size, budgeted_hours, conclusion, created_at, updated_at")
      .eq("audit_id", auditId)
      .order("control_id", { ascending: true })
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })
      .returns<ControlTestingMatrixRow[]>(),
    supabase
      .from("control_testing_matrix_attributes")
      .select("id, matrix_id, attribute_key, label, guidance, display_order")
      .returns<ControlTestingMatrixAttributeRow[]>(),
    supabase
      .from("control_testing_matrix_samples")
      .select("id, matrix_id, sample_identifier, sample_description, source_reference, exception_noted, display_order, tested_by_user_id, started_at, completed_at, time_spent_minutes")
      .returns<ControlTestingMatrixSampleRow[]>(),
    supabase
      .from("control_testing_matrix_results")
      .select("id, matrix_id, sample_id, attribute_id, result")
      .returns<ControlTestingMatrixResultRow[]>(),
    supabase
      .from("controls")
      .select("id, source_payload")
      .eq("audit_id", auditId)
      .returns<ControlRcmPayloadRow[]>(),
  ]);

  if (matricesResult.error) {
    throw new Error(matricesResult.error.message);
  }
  if (attributesResult.error) {
    throw new Error(attributesResult.error.message);
  }
  if (samplesResult.error) {
    throw new Error(samplesResult.error.message);
  }
  if (resultsResult.error) {
    throw new Error(resultsResult.error.message);
  }
  if (controlsResult.error) {
    throw new Error(controlsResult.error.message);
  }

  const matrices = matricesResult.data ?? [];
  const matrixIds = new Set(matrices.map((matrix) => matrix.id));
  const rcmTestPlanByControlId = new Map(
    (controlsResult.data ?? [])
      .map((control) => [control.id, readRcmTestPlan(control.source_payload ?? {})] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
  );
  const attributesByMatrixId = groupByMatrixId(
    (attributesResult.data ?? [])
      .filter((attribute) => matrixIds.has(attribute.matrix_id))
      .map(mapControlTestingMatrixAttribute),
  );
  const samplesByMatrixId = groupByMatrixId(
    (samplesResult.data ?? [])
      .filter((sample) => matrixIds.has(sample.matrix_id))
      .map(mapControlTestingMatrixSample),
  );
  const resultsByMatrixId = groupByMatrixId(
    (resultsResult.data ?? [])
      .filter((result) => matrixIds.has(result.matrix_id))
      .map(mapControlTestingMatrixResult),
  );

  return matrices
    .map((matrix) =>
      mapControlTestingMatrix({
        matrix: {
          ...matrix,
          sample_description: resolveMatrixSampleDescription(matrix.sample_description, rcmTestPlanByControlId.get(matrix.control_id)),
        },
        attributes: attributesByMatrixId[matrix.id] ?? [],
        samples: samplesByMatrixId[matrix.id] ?? [],
        results: resultsByMatrixId[matrix.id] ?? [],
      }),
    )
    .sort((left, right) => left.controlId.localeCompare(right.controlId) || left.displayOrder - right.displayOrder || left.createdAt.localeCompare(right.createdAt));
}

export async function loadControlTestingMatrix(auditId: string, controlId: string) {
  const matrices = await loadControlTestingMatricesForControl(auditId, controlId);
  return matrices[0] ?? null;
}

export async function loadControlTestingMatricesForControl(auditId: string, controlId: string) {
  const supabase = createSupabaseAdminClient();
  const matrices = await loadAuditControlTestingMatrices(supabase, auditId);
  return matrices.filter((matrix) => matrix.controlId === controlId).sort((left, right) => left.displayOrder - right.displayOrder || left.createdAt.localeCompare(right.createdAt));
}

export async function saveControlTestingMatrix(args: SaveTestingMatrixInput) {
  const supabase = createSupabaseAdminClient();
  const { auditId, controlId, matrix } = args;
  await assertControlBelongsToAudit(supabase, auditId, controlId);

  const requestedMatrixId = matrix.id && isPersistedId(matrix.id) ? matrix.id : null;
  const existingMatrix = requestedMatrixId
    ? await getExistingMatrixById(supabase, auditId, controlId, requestedMatrixId)
    : matrix.displayOrder === 1
      ? await getExistingMatrixByOrder(supabase, auditId, controlId, 1)
      : null;
  const matrixId = existingMatrix?.id ?? (await insertMatrixRecord(supabase, auditId, controlId, matrix));

  if (existingMatrix) {
    await updateMatrixRecord(supabase, existingMatrix.id, matrix);
  }

  const attributes = await syncAttributes(supabase, matrixId, matrix.attributes);
  const samples = await syncSamples(supabase, matrixId, matrix.samples);
  const attributeIdMap = new Map(attributes.map((attribute) => [attribute.clientId, attribute.id]));
  const sampleIdMap = new Map(samples.map((sample) => [sample.clientId, sample.id]));
  await syncResults(supabase, matrixId, matrix.results, sampleIdMap, attributeIdMap);
  await applyExecutionTimestamps(supabase, matrixId, args.testedByUserId);

  const savedMatrix = await loadControlTestingMatrixById(auditId, controlId, matrixId);

  if (!savedMatrix) {
    throw new Error("The testing matrix could not be reloaded after save.");
  }

  return savedMatrix;
}

export async function deleteControlTestingMatrix(args: { auditId: string; controlId: string; matrixId: string }) {
  const supabase = createSupabaseAdminClient();
  const { auditId, controlId, matrixId } = args;
  await assertControlBelongsToAudit(supabase, auditId, controlId);
  const matrices = await loadControlTestingMatricesForControl(auditId, controlId);

  if (!matrices.some((matrix) => matrix.id === matrixId)) {
    throw new Error("The testing matrix was not found for this control.");
  }

  if (matrices.length <= 1) {
    throw new Error("A control must keep at least one testing matrix.");
  }

  const { error } = await supabase.from("control_testing_matrices").delete().eq("id", matrixId).eq("audit_id", auditId).eq("control_id", controlId);

  if (error) {
    throw new Error(error.message);
  }

  const remainingMatrices = (await loadControlTestingMatricesForControl(auditId, controlId)).sort(
    (left, right) => left.displayOrder - right.displayOrder || left.createdAt.localeCompare(right.createdAt),
  );

  for (const [index, matrix] of remainingMatrices.entries()) {
    const nextDisplayOrder = index + 1;

    if (matrix.displayOrder === nextDisplayOrder) {
      continue;
    }

    const { error: updateError } = await supabase
      .from("control_testing_matrices")
      .update({ display_order: nextDisplayOrder, updated_at: new Date().toISOString() })
      .eq("id", matrix.id);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  return loadControlTestingMatricesForControl(auditId, controlId);
}

async function assertControlBelongsToAudit(supabase: SupabaseAdminClient, auditId: string, controlId: string) {
  const { data, error } = await supabase
    .from("controls")
    .select("id")
    .eq("audit_id", auditId)
    .eq("id", controlId)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("The requested control was not found for this audit.");
  }
}

async function loadControlTestingMatrixById(auditId: string, controlId: string, matrixId: string) {
  const matrices = await loadControlTestingMatricesForControl(auditId, controlId);
  return matrices.find((matrix) => matrix.id === matrixId) ?? null;
}

async function getExistingMatrixById(supabase: SupabaseAdminClient, auditId: string, controlId: string, matrixId: string) {
  const { data, error } = await supabase
    .from("control_testing_matrices")
    .select("id")
    .eq("audit_id", auditId)
    .eq("control_id", controlId)
    .eq("id", matrixId)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function getExistingMatrixByOrder(supabase: SupabaseAdminClient, auditId: string, controlId: string, displayOrder: number) {
  const { data, error } = await supabase
    .from("control_testing_matrices")
    .select("id")
    .eq("audit_id", auditId)
    .eq("control_id", controlId)
    .eq("display_order", displayOrder)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function insertMatrixRecord(
  supabase: SupabaseAdminClient,
  auditId: string,
  controlId: string,
  matrix: SaveTestingMatrixInput["matrix"],
) {
  const { data, error } = await supabase
    .from("control_testing_matrices")
    .insert({
      audit_id: auditId,
      control_id: controlId,
      display_order: await getNextMatrixDisplayOrder(supabase, auditId, controlId),
      title: matrix.title.trim(),
      population_description: matrix.populationDescription.trim(),
      population_size: matrix.populationSize ?? null,
      sample_description: matrix.sampleDescription.trim(),
      sample_size: matrix.sampleSize ?? null,
      budgeted_hours: normalizeBudgetHours(matrix.budgetedHours),
      conclusion: matrix.conclusion.trim(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Unable to create the testing matrix.");
  }

  return data.id;
}

async function updateMatrixRecord(
  supabase: SupabaseAdminClient,
  matrixId: string,
  matrix: SaveTestingMatrixInput["matrix"],
) {
  const { error } = await supabase
    .from("control_testing_matrices")
    .update({
      title: matrix.title.trim(),
      population_description: matrix.populationDescription.trim(),
      population_size: matrix.populationSize ?? null,
      sample_description: matrix.sampleDescription.trim(),
      sample_size: matrix.sampleSize ?? null,
      budgeted_hours: normalizeBudgetHours(matrix.budgetedHours),
      conclusion: matrix.conclusion.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", matrixId);

  if (error) {
    throw new Error(error.message);
  }
}

async function syncAttributes(
  supabase: SupabaseAdminClient,
  matrixId: string,
  attributes: SaveTestingMatrixInput["matrix"]["attributes"],
) {
  const usedKeys = new Set<string>();
  const normalizedAttributes = attributes.map((attribute, index) => {
    const baseKey = sanitizeAttributeKey(attribute.attributeKey ?? attribute.label, index);
    const attributeKey = dedupeKey(baseKey, usedKeys);

    return {
      clientId: attribute.clientId ?? attribute.id ?? `new-attribute-${index}`,
      id: attribute.id,
      matrix_id: matrixId,
      attribute_key: attributeKey,
      label: attribute.label.trim(),
      guidance: attribute.guidance.trim(),
      display_order: attribute.displayOrder,
      updated_at: new Date().toISOString(),
    };
  });

  const retainedIds = normalizedAttributes.flatMap((attribute) => (attribute.id ? [attribute.id] : []));
  const { data: existingRows, error: existingError } = await supabase
    .from("control_testing_matrix_attributes")
    .select("id")
    .eq("matrix_id", matrixId)
    .returns<Array<{ id: string }>>();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const idsToDelete = (existingRows ?? []).map((row) => row.id).filter((id) => !retainedIds.includes(id));

  if (idsToDelete.length > 0) {
    const { error } = await supabase.from("control_testing_matrix_attributes").delete().in("id", idsToDelete);

    if (error) {
      throw new Error(error.message);
    }
  }

  const rowsToUpdate = normalizedAttributes.filter((attribute) => attribute.id);
  for (const row of rowsToUpdate) {
    const { error } = await supabase
      .from("control_testing_matrix_attributes")
      .update({
        attribute_key: row.attribute_key,
        label: row.label,
        guidance: row.guidance,
        display_order: row.display_order,
        updated_at: row.updated_at,
      })
      .eq("id", row.id as string);

    if (error) {
      throw new Error(error.message);
    }
  }

  const rowsToInsert = normalizedAttributes.filter((attribute) => !attribute.id);
  if (rowsToInsert.length > 0) {
    const { error } = await supabase.from("control_testing_matrix_attributes").insert(rowsToInsert.map(({ clientId, id, ...row }) => row));

    if (error) {
      throw new Error(error.message);
    }
  }

  const { data, error } = await supabase
    .from("control_testing_matrix_attributes")
    .select("id, matrix_id, attribute_key, label, guidance, display_order")
    .eq("matrix_id", matrixId)
    .order("display_order", { ascending: true })
    .returns<ControlTestingMatrixAttributeRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  const mapped = (data ?? []).map(mapControlTestingMatrixAttribute);

  return normalizedAttributes.map((attribute) => ({
    clientId: attribute.clientId,
    id:
      mapped.find(
        (candidate) =>
          candidate.attributeKey === attribute.attribute_key &&
          candidate.displayOrder === attribute.display_order &&
          candidate.label === attribute.label,
      )?.id ?? "",
  }));
}

async function syncSamples(
  supabase: SupabaseAdminClient,
  matrixId: string,
  samples: SaveTestingMatrixInput["matrix"]["samples"],
) {
  const normalizedSamples = samples.map((sample, index) => ({
    clientId: sample.clientId ?? sample.id ?? `new-sample-${index}`,
    id: sample.id,
    matrix_id: matrixId,
    sample_identifier: sample.sampleIdentifier.trim() || `S-${String(index + 1).padStart(2, "0")}`,
    sample_description: sample.sampleDescription.trim(),
    source_reference: sample.sourceReference.trim(),
    exception_noted: sample.exceptionNoted.trim(),
    display_order: sample.displayOrder,
    time_spent_minutes: normalizeMinutes(sample.timeSpentMinutes),
    updated_at: new Date().toISOString(),
  }));

  const retainedIds = normalizedSamples.flatMap((sample) => (sample.id ? [sample.id] : []));
  const { data: existingRows, error: existingError } = await supabase
    .from("control_testing_matrix_samples")
    .select("id")
    .eq("matrix_id", matrixId)
    .returns<Array<{ id: string }>>();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const idsToDelete = (existingRows ?? []).map((row) => row.id).filter((id) => !retainedIds.includes(id));

  if (idsToDelete.length > 0) {
    const { error } = await supabase.from("control_testing_matrix_samples").delete().in("id", idsToDelete);

    if (error) {
      throw new Error(error.message);
    }
  }

  const rowsToUpdate = normalizedSamples.filter((sample) => sample.id);
  for (const row of rowsToUpdate) {
    const { error } = await supabase
      .from("control_testing_matrix_samples")
      .update({
        sample_identifier: row.sample_identifier,
        sample_description: row.sample_description,
        source_reference: row.source_reference,
        exception_noted: row.exception_noted,
        display_order: row.display_order,
        time_spent_minutes: row.time_spent_minutes,
        updated_at: row.updated_at,
      })
      .eq("id", row.id as string);

    if (error) {
      throw new Error(error.message);
    }
  }

  const rowsToInsert = normalizedSamples.filter((sample) => !sample.id);
  if (rowsToInsert.length > 0) {
    const { error } = await supabase.from("control_testing_matrix_samples").insert(rowsToInsert.map(({ clientId, id, ...row }) => row));

    if (error) {
      throw new Error(error.message);
    }
  }

  const { data, error } = await supabase
    .from("control_testing_matrix_samples")
    .select("id, matrix_id, sample_identifier, sample_description, source_reference, exception_noted, display_order, tested_by_user_id, started_at, completed_at, time_spent_minutes")
    .eq("matrix_id", matrixId)
    .order("display_order", { ascending: true })
    .returns<ControlTestingMatrixSampleRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  const mapped = (data ?? []).map(mapControlTestingMatrixSample);

  return normalizedSamples.map((sample) => ({
    clientId: sample.clientId,
    id:
      mapped.find(
        (candidate) =>
          candidate.sampleIdentifier === sample.sample_identifier &&
          candidate.displayOrder === sample.display_order &&
          candidate.sampleDescription === sample.sample_description,
      )?.id ?? "",
  }));
}

async function syncResults(
  supabase: SupabaseAdminClient,
  matrixId: string,
  results: SaveTestingMatrixInput["matrix"]["results"],
  sampleIdMap: Map<string, string>,
  attributeIdMap: Map<string, string>,
) {
  const normalizedResults = results.flatMap((result, index) => {
    const sampleId = sampleIdMap.get(result.sampleId) ?? result.sampleId;
    const attributeId = attributeIdMap.get(result.attributeId) ?? result.attributeId;

    if (!sampleId || !attributeId) {
      return [];
    }

    return [
      {
        id: result.id,
        matrix_id: matrixId,
        sample_id: sampleId,
        attribute_id: attributeId,
        result: result.result,
        updated_at: new Date().toISOString(),
      },
    ];
  });

  const { data: existingRows, error: existingError } = await supabase
    .from("control_testing_matrix_results")
    .select("id, sample_id, attribute_id")
    .eq("matrix_id", matrixId)
    .returns<Array<{ id: string; sample_id: string; attribute_id: string }>>();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const desiredKeys = new Set(normalizedResults.map((result) => `${result.sample_id}:${result.attribute_id}`));
  const idsToDelete = (existingRows ?? [])
    .filter((row) => !desiredKeys.has(`${row.sample_id}:${row.attribute_id}`))
    .map((row) => row.id);

  if (idsToDelete.length > 0) {
    const { error } = await supabase.from("control_testing_matrix_results").delete().in("id", idsToDelete);

    if (error) {
      throw new Error(error.message);
    }
  }

  const rowsToUpsert = normalizedResults.map(({ id: _id, updated_at, ...row }) => ({
    ...row,
    updated_at,
  }));

  if (rowsToUpsert.length > 0) {
    const { error } = await supabase
      .from("control_testing_matrix_results")
      .upsert(rowsToUpsert, { onConflict: "sample_id,attribute_id" });

    if (error) {
      throw new Error(error.message);
    }
  }
}

function normalizeBudgetHours(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  const rounded = Math.round(value * 100) / 100;
  return rounded >= 0 ? rounded : null;
}

function normalizeMinutes(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  const rounded = Math.round(value);
  return rounded >= 0 ? rounded : null;
}

/**
 * Stamp per-sample execution timing based on recorded results.
 * - started_at is set the first time any attribute for a sample is marked PASS/FAIL.
 * - completed_at is set once every attribute for the sample has a non-"NOT_TESTED" result.
 * - tested_by_user_id records the active tester on first touch.
 * Reopening a sample (clearing all results) resets the timestamps.
 */
async function applyExecutionTimestamps(supabase: SupabaseAdminClient, matrixId: string, testedByUserId?: string) {
  const [{ data: attributeRows, error: attributesError }, { data: sampleRows, error: samplesError }, { data: resultRows, error: resultsError }] =
    await Promise.all([
      supabase.from("control_testing_matrix_attributes").select("id").eq("matrix_id", matrixId).returns<Array<{ id: string }>>(),
      supabase
        .from("control_testing_matrix_samples")
        .select("id, started_at, completed_at, tested_by_user_id")
        .eq("matrix_id", matrixId)
        .returns<Array<{ id: string; started_at: string | null; completed_at: string | null; tested_by_user_id: string | null }>>(),
      supabase
        .from("control_testing_matrix_results")
        .select("sample_id, result")
        .eq("matrix_id", matrixId)
        .returns<Array<{ sample_id: string; result: string }>>(),
    ]);

  if (attributesError) {
    throw new Error(attributesError.message);
  }
  if (samplesError) {
    throw new Error(samplesError.message);
  }
  if (resultsError) {
    throw new Error(resultsError.message);
  }

  const attributeCount = (attributeRows ?? []).length;
  const testedBySample = new Map<string, number>();

  for (const result of resultRows ?? []) {
    if (result.result === "PASS" || result.result === "FAIL") {
      testedBySample.set(result.sample_id, (testedBySample.get(result.sample_id) ?? 0) + 1);
    }
  }

  const nowIso = new Date().toISOString();

  for (const sample of sampleRows ?? []) {
    const testedCount = testedBySample.get(sample.id) ?? 0;
    const touched = testedCount > 0;
    const complete = attributeCount > 0 && testedCount >= attributeCount;

    const update: Record<string, string | null> = {};

    if (touched) {
      if (!sample.started_at) {
        update.started_at = nowIso;
      }
      if (!sample.tested_by_user_id && testedByUserId) {
        update.tested_by_user_id = testedByUserId;
      }
      if (complete) {
        if (!sample.completed_at) {
          update.completed_at = nowIso;
        }
      } else if (sample.completed_at) {
        update.completed_at = null;
      }
    } else {
      if (sample.started_at) {
        update.started_at = null;
      }
      if (sample.completed_at) {
        update.completed_at = null;
      }
    }

    if (Object.keys(update).length === 0) {
      continue;
    }

    const { error } = await supabase.from("control_testing_matrix_samples").update(update).eq("id", sample.id);

    if (error) {
      throw new Error(error.message);
    }
  }
}

function groupByMatrixId<T extends { matrixId: string }>(items: T[]) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const existing = groups[item.matrixId] ?? [];
    existing.push(item);
    groups[item.matrixId] = existing;
    return groups;
  }, {});
}

function resolveMatrixSampleDescription(currentValue: string | null, rcmTestPlan: string | undefined) {
  const trimmed = currentValue?.trim() ?? "";

  if (!rcmTestPlan || !isLegacySummarizedRcmTestPlan(trimmed)) {
    return currentValue;
  }

  return rcmTestPlan;
}

function isLegacySummarizedRcmTestPlan(value: string) {
  return (
    value.startsWith("Testing plan sourced from the RCM: ") &&
    value.endsWith(" Complete sample selection after documenting the population and sampling approach.")
  );
}

function readRcmTestPlan(payload: Record<string, unknown>) {
  return readString(payload, ["test_plan"]);
}

function readString(payload: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const entry = Object.entries(payload).find(([key]) => normalizeKey(key) === normalizeKey(alias));

    if (!entry) {
      continue;
    }

    const value = entry[1];

    if (value === null || value === undefined) {
      continue;
    }

    const stringValue = String(value).trim();

    if (stringValue.length > 0) {
      return stringValue;
    }
  }

  return null;
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

async function getNextMatrixDisplayOrder(supabase: SupabaseAdminClient, auditId: string, controlId: string) {
  const { data, error } = await supabase
    .from("control_testing_matrices")
    .select("display_order")
    .eq("audit_id", auditId)
    .eq("control_id", controlId)
    .order("display_order", { ascending: false })
    .limit(1)
    .returns<Array<{ display_order: number | null }>>();

  if (error) {
    throw new Error(error.message);
  }

  return (data?.[0]?.display_order ?? 0) + 1;
}

function isPersistedId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sanitizeAttributeKey(value: string, index: number) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || `attribute_${index + 1}`;
}

function dedupeKey(baseKey: string, usedKeys: Set<string>) {
  let candidate = baseKey;
  let suffix = 2;

  while (usedKeys.has(candidate)) {
    candidate = `${baseKey}_${suffix}`;
    suffix += 1;
  }

  usedKeys.add(candidate);
  return candidate;
}
