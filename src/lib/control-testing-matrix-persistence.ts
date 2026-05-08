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

type SaveTestingMatrixInput = {
  auditId: string;
  controlId: string;
  matrix: {
    title: string;
    populationDescription: string;
    populationSize?: number;
    sampleDescription: string;
    sampleSize?: number;
    conclusion: string;
    attributes: Array<{
      id?: string;
      attributeKey?: string;
      label: string;
      guidance: string;
      displayOrder: number;
    }>;
    samples: Array<{
      id?: string;
      sampleIdentifier: string;
      sampleDescription: string;
      sourceReference: string;
      exceptionNoted: string;
      displayOrder: number;
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
  const [matricesResult, attributesResult, samplesResult, resultsResult] = await Promise.all([
    supabase
      .from("control_testing_matrices")
      .select("id, audit_id, control_id, title, population_description, population_size, sample_description, sample_size, conclusion, created_at, updated_at")
      .eq("audit_id", auditId)
      .returns<ControlTestingMatrixRow[]>(),
    supabase
      .from("control_testing_matrix_attributes")
      .select("id, matrix_id, attribute_key, label, guidance, display_order")
      .returns<ControlTestingMatrixAttributeRow[]>(),
    supabase
      .from("control_testing_matrix_samples")
      .select("id, matrix_id, sample_identifier, sample_description, source_reference, exception_noted, display_order")
      .returns<ControlTestingMatrixSampleRow[]>(),
    supabase
      .from("control_testing_matrix_results")
      .select("id, matrix_id, sample_id, attribute_id, result")
      .returns<ControlTestingMatrixResultRow[]>(),
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

  const matrices = matricesResult.data ?? [];
  const matrixIds = new Set(matrices.map((matrix) => matrix.id));
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

  return matrices.map((matrix) =>
    mapControlTestingMatrix({
      matrix,
      attributes: attributesByMatrixId[matrix.id] ?? [],
      samples: samplesByMatrixId[matrix.id] ?? [],
      results: resultsByMatrixId[matrix.id] ?? [],
    }),
  );
}

export async function loadControlTestingMatrix(auditId: string, controlId: string) {
  const supabase = createSupabaseAdminClient();
  const matrices = await loadAuditControlTestingMatrices(supabase, auditId);
  return matrices.find((matrix) => matrix.controlId === controlId) ?? null;
}

export async function saveControlTestingMatrix(args: SaveTestingMatrixInput) {
  const supabase = createSupabaseAdminClient();
  const { auditId, controlId, matrix } = args;
  await assertControlBelongsToAudit(supabase, auditId, controlId);

  const existingMatrix = await getExistingMatrix(supabase, auditId, controlId);
  const matrixId = existingMatrix?.id ?? (await upsertMatrixRecord(supabase, auditId, controlId, matrix));

  if (existingMatrix) {
    await updateMatrixRecord(supabase, existingMatrix.id, matrix);
  }

  const attributes = await syncAttributes(supabase, matrixId, matrix.attributes);
  const samples = await syncSamples(supabase, matrixId, matrix.samples);
  const attributeIdMap = new Map(attributes.map((attribute) => [attribute.clientId, attribute.id]));
  const sampleIdMap = new Map(samples.map((sample) => [sample.clientId, sample.id]));
  await syncResults(supabase, matrixId, matrix.results, sampleIdMap, attributeIdMap);

  const savedMatrix = await loadControlTestingMatrix(auditId, controlId);

  if (!savedMatrix) {
    throw new Error("The testing matrix could not be reloaded after save.");
  }

  return savedMatrix;
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

async function getExistingMatrix(supabase: SupabaseAdminClient, auditId: string, controlId: string) {
  const { data, error } = await supabase
    .from("control_testing_matrices")
    .select("id")
    .eq("audit_id", auditId)
    .eq("control_id", controlId)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function upsertMatrixRecord(
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
      title: matrix.title.trim(),
      population_description: matrix.populationDescription.trim(),
      population_size: matrix.populationSize ?? null,
      sample_description: matrix.sampleDescription.trim(),
      sample_size: matrix.sampleSize ?? null,
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
    clientId: attribute.id ?? `new-attribute-${index}`,
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
    clientId: sample.id ?? `new-sample-${index}`,
    id: sample.id,
    matrix_id: matrixId,
    sample_identifier: sample.sampleIdentifier.trim() || `S-${String(index + 1).padStart(2, "0")}`,
    sample_description: sample.sampleDescription.trim(),
    source_reference: sample.sourceReference.trim(),
    exception_noted: sample.exceptionNoted.trim(),
    display_order: sample.displayOrder,
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
    .select("id, matrix_id, sample_identifier, sample_description, source_reference, exception_noted, display_order")
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

  const rowsToUpsert = normalizedResults.map(({ updated_at, ...row }) => ({
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

function groupByMatrixId<T extends { matrixId: string }>(items: T[]) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const existing = groups[item.matrixId] ?? [];
    existing.push(item);
    groups[item.matrixId] = existing;
    return groups;
  }, {});
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
