import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ReviewNote, ReviewNoteAction, ReviewNoteEvent, ReviewNoteStatus } from "@/types/audit";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type ReviewNoteRow = {
  id: string;
  audit_id: string;
  document_id: string;
  status: string;
  note: string;
  created_by_user_id: string | null;
  created_by_name: string;
  assigned_to_user_id: string | null;
  assigned_to_name: string;
  reopen_count?: number | null;
  created_at: string;
  cleared_at: string | null;
  closed_at: string | null;
  last_activity_at: string;
  updated_at: string;
};

type ReviewNoteEventRow = {
  id: string;
  note_id: string;
  action: string;
  actor_name: string;
  actor_user_id: string | null;
  comment: string;
  created_at: string;
};

const NOTE_COLUMNS =
  "id, audit_id, document_id, status, note, created_by_user_id, created_by_name, assigned_to_user_id, assigned_to_name, created_at, cleared_at, closed_at, last_activity_at, updated_at";

// Note lifecycle: OPEN -> CLEARED (tester) -> CLOSED (reviewer); reopen -> OPEN.
// "reply" posts a message without changing status.
export type ReviewNoteActionInput = "reply" | "clear" | "reopen" | "close";

function normalizeStatus(value: string): ReviewNoteStatus {
  switch (value) {
    case "OPEN":
    case "CLEARED":
    case "CLOSED":
      return value;
    default:
      return "OPEN";
  }
}

function normalizeEventAction(value: string): ReviewNoteAction {
  switch (value) {
    case "RAISED":
    case "COMMENT":
    case "CLEARED":
    case "REOPENED":
    case "CLOSED":
      return value;
    default:
      return "COMMENT";
  }
}

function mapEvent(row: ReviewNoteEventRow): ReviewNoteEvent {
  return {
    id: row.id,
    action: normalizeEventAction(row.action),
    actorName: row.actor_name,
    actorUserId: row.actor_user_id ?? undefined,
    comment: row.comment ?? "",
    createdAt: row.created_at,
  };
}

function mapNote(row: ReviewNoteRow, events: ReviewNoteEvent[]): ReviewNote {
  return {
    id: row.id,
    auditId: row.audit_id,
    documentId: row.document_id,
    status: normalizeStatus(row.status),
    note: row.note,
    createdByName: row.created_by_name,
    createdByUserId: row.created_by_user_id ?? undefined,
    assignedToName: row.assigned_to_name,
    assignedToUserId: row.assigned_to_user_id ?? undefined,
    reopenCount: row.reopen_count ?? 0,
    createdAt: row.created_at,
    clearedAt: row.cleared_at ?? undefined,
    closedAt: row.closed_at ?? undefined,
    lastActivityAt: row.last_activity_at,
    events: events.sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
  };
}

async function loadEventsForNotes(supabase: SupabaseAdminClient, noteIds: string[]) {
  if (noteIds.length === 0) {
    return new Map<string, ReviewNoteEvent[]>();
  }

  const { data, error } = await supabase
    .from("workpaper_review_note_events")
    .select("id, note_id, action, actor_name, actor_user_id, comment, created_at")
    .in("note_id", noteIds)
    .order("created_at", { ascending: true })
    .returns<ReviewNoteEventRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  const grouped = new Map<string, ReviewNoteEvent[]>();
  for (const row of data ?? []) {
    const existing = grouped.get(row.note_id) ?? [];
    existing.push(mapEvent(row));
    grouped.set(row.note_id, existing);
  }

  return grouped;
}

function sortNotes(notes: ReviewNote[]) {
  const statusRank: Record<ReviewNoteStatus, number> = {
    OPEN: 0,
    CLEARED: 1,
    CLOSED: 2,
  };

  return notes.sort(
    (left, right) => statusRank[left.status] - statusRank[right.status] || right.lastActivityAt.localeCompare(left.lastActivityAt),
  );
}

export async function loadAuditReviewNotes(supabase: SupabaseAdminClient, auditId: string): Promise<ReviewNote[]> {
  const { data, error } = await supabase
    .from("workpaper_review_notes")
    .select(NOTE_COLUMNS)
    .eq("audit_id", auditId)
    .returns<ReviewNoteRow[]>();

  if (error) {
    if (error.message.includes("workpaper_review_notes")) {
      return [];
    }
    throw new Error(error.message);
  }

  const rows = data ?? [];
  const eventsByNote = await loadEventsForNotes(supabase, rows.map((row) => row.id));

  return sortNotes(rows.map((row) => mapNote(row, eventsByNote.get(row.id) ?? [])));
}

export async function loadDocumentReviewNotes(auditId: string, documentId: string): Promise<ReviewNote[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("workpaper_review_notes")
    .select(NOTE_COLUMNS)
    .eq("audit_id", auditId)
    .eq("document_id", documentId)
    .returns<ReviewNoteRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  const rows = data ?? [];
  const eventsByNote = await loadEventsForNotes(supabase, rows.map((row) => row.id));

  return sortNotes(rows.map((row) => mapNote(row, eventsByNote.get(row.id) ?? [])));
}

/**
 * Count notes still requiring tester action (OPEN) for a workpaper. Used to gate
 * the workpaper-level "Send back" action (it requires at least one open note).
 */
export async function countOpenNotesForDocument(auditId: string, documentId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("workpaper_review_notes")
    .select("id", { count: "exact", head: true })
    .eq("audit_id", auditId)
    .eq("document_id", documentId)
    .eq("status", "OPEN");

  if (error) {
    if (error.message.includes("workpaper_review_notes")) {
      return 0;
    }
    throw new Error(error.message);
  }

  return count ?? 0;
}

async function loadNoteById(supabase: SupabaseAdminClient, auditId: string, noteId: string) {
  const { data, error } = await supabase
    .from("workpaper_review_notes")
    .select(NOTE_COLUMNS)
    .eq("audit_id", auditId)
    .eq("id", noteId)
    .maybeSingle<ReviewNoteRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function createReviewNote(input: {
  auditId: string;
  documentId: string;
  note: string;
  createdByUserId?: string;
  createdByName: string;
  assignedToUserId?: string;
  assignedToName?: string;
}): Promise<ReviewNote> {
  const supabase = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("workpaper_review_notes")
    .insert({
      audit_id: input.auditId,
      document_id: input.documentId,
      status: "OPEN",
      note: input.note.trim(),
      created_by_user_id: input.createdByUserId ?? null,
      created_by_name: input.createdByName,
      assigned_to_user_id: input.assignedToUserId ?? null,
      assigned_to_name: input.assignedToName ?? "",
      created_at: nowIso,
      last_activity_at: nowIso,
      updated_at: nowIso,
    })
    .select(NOTE_COLUMNS)
    .maybeSingle<ReviewNoteRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Unable to create the review note.");
  }

  await supabase.from("workpaper_review_note_events").insert({
    note_id: data.id,
    action: "RAISED",
    actor_name: input.createdByName,
    actor_user_id: input.createdByUserId ?? null,
    comment: "",
    created_at: nowIso,
  });

  const events = await loadEventsForNotes(supabase, [data.id]);
  return mapNote(data, events.get(data.id) ?? []);
}

const actionToEvent: Record<ReviewNoteActionInput, ReviewNoteAction> = {
  reply: "COMMENT",
  clear: "CLEARED",
  reopen: "REOPENED",
  close: "CLOSED",
};

export async function applyReviewNoteAction(input: {
  auditId: string;
  noteId: string;
  action: ReviewNoteActionInput;
  actorName: string;
  actorUserId?: string;
  comment?: string;
}): Promise<ReviewNote> {
  const supabase = createSupabaseAdminClient();
  const existing = await loadNoteById(supabase, input.auditId, input.noteId);

  if (!existing) {
    throw new Error("The review note was not found for this audit.");
  }

  const nowIso = new Date().toISOString();
  const update: Record<string, string | number | null> = {
    last_activity_at: nowIso,
    updated_at: nowIso,
  };

  switch (input.action) {
    case "clear":
      update.status = "CLEARED";
      if (!existing.cleared_at) {
        update.cleared_at = nowIso;
      }
      update.closed_at = null;
      break;
    case "close":
      update.status = "CLOSED";
      if (!existing.cleared_at) {
        update.cleared_at = nowIso;
      }
      update.closed_at = nowIso;
      break;
    case "reopen":
      update.status = "OPEN";
      update.cleared_at = null;
      update.closed_at = null;
      break;
    case "reply":
    default:
      // No status change; the COMMENT event below carries the reply.
      break;
  }

  const { error: updateError } = await supabase.from("workpaper_review_notes").update(update).eq("id", input.noteId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: eventError } = await supabase.from("workpaper_review_note_events").insert({
    note_id: input.noteId,
    action: actionToEvent[input.action],
    actor_name: input.actorName,
    actor_user_id: input.actorUserId ?? null,
    comment: input.comment?.trim() ?? "",
    created_at: nowIso,
  });

  if (eventError) {
    throw new Error(eventError.message);
  }

  const refreshed = await loadNoteById(supabase, input.auditId, input.noteId);

  if (!refreshed) {
    throw new Error("Unable to reload the review note after updating it.");
  }

  const events = await loadEventsForNotes(supabase, [input.noteId]);
  return mapNote(refreshed, events.get(input.noteId) ?? []);
}
