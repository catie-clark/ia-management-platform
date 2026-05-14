import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/supabase/env";

type SupabaseRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: HeadersInit;
};

type SupabaseErrorPayload = {
  message?: string;
  error?: string;
  details?: string;
  hint?: string;
};

function getSupabaseAdminConfig() {
  return {
    supabaseUrl: getSupabaseUrl(),
    serviceRoleKey: getSupabaseServiceRoleKey(),
  };
}

export async function supabaseRestRequest<T>(path: string, options: SupabaseRequestOptions = {}): Promise<T> {
  const { supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig();
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as SupabaseErrorPayload | null;
    const errorMessage =
      errorPayload?.message ??
      errorPayload?.error ??
      errorPayload?.details ??
      `Supabase request failed with status ${response.status}.`;

    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const responseText = await response.text();

  if (responseText.trim().length === 0) {
    return undefined as T;
  }

  return JSON.parse(responseText) as T;
}

export async function insertSingleRow<T>(table: string, payload: unknown): Promise<T> {
  const rows = await supabaseRestRequest<T[]>(table, {
    method: "POST",
    body: payload,
    headers: {
      Prefer: "return=representation",
    },
  });

  const [row] = rows;

  if (!row) {
    throw new Error(`Supabase did not return the inserted row for ${table}.`);
  }

  return row;
}

export async function insertManyRows(table: string, payload: unknown): Promise<void> {
  await supabaseRestRequest<void>(table, {
    method: "POST",
    body: payload,
    headers: {
      Prefer: "return=minimal",
    },
  });
}

export async function upsertManyRows(tableWithQuery: string, payload: unknown): Promise<void> {
  await supabaseRestRequest<void>(tableWithQuery, {
    method: "POST",
    body: payload,
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
  });
}

export async function patchRows(tableWithQuery: string, payload: unknown): Promise<void> {
  await supabaseRestRequest<void>(tableWithQuery, {
    method: "PATCH",
    body: payload,
    headers: {
      Prefer: "return=minimal",
    },
  });
}

export async function deleteRows(tableWithQuery: string): Promise<void> {
  await supabaseRestRequest<void>(tableWithQuery, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal",
    },
  });
}
