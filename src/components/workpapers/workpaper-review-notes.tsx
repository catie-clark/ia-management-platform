"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";

import { useActiveUser } from "@/components/layout/active-user-context";
import { useNotification } from "@/components/ui/notification-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/utils";
import type { ReviewNote, ReviewNoteEvent, ReviewNoteStatus } from "@/types/audit";

type NotesResponse = { notes?: ReviewNote[]; error?: string };

export function WorkpaperReviewNotes({
  auditId,
  documentId,
  mode,
  canReview,
  canAuthor,
  preparerName,
  preparerUserId,
  onNotesChanged,
}: {
  auditId: string | null;
  documentId: string;
  mode: "live" | "prototype";
  canReview: boolean;
  canAuthor: boolean;
  preparerName: string;
  preparerUserId?: string;
  onNotesChanged?: (notes: ReviewNote[]) => void;
}) {
  const router = useRouter();
  const { activeUser } = useActiveUser();
  const { showNotification } = useNotification();
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [raiseText, setRaiseText] = useState("");
  const [replyByNote, setReplyByNote] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const canPersist = mode === "live" && Boolean(auditId);

  useEffect(() => {
    if (!canPersist || !auditId) {
      setNotes([]);
      onNotesChanged?.([]);
      return;
    }

    let cancelled = false;

    async function loadNotes() {
      try {
        const response = await fetch(`/api/audits/${auditId}/workpapers/${documentId}/review-notes`, { cache: "no-store" });
        const result = (await response.json()) as NotesResponse;
        if (!cancelled && response.ok && result.notes) {
          setNotes(result.notes);
          onNotesChanged?.(result.notes);
        }
      } catch {
        // Leave the panel usable on load failure.
      }
    }

    void loadNotes();
    return () => {
      cancelled = true;
    };
    // onNotesChanged intentionally omitted — parent passes a stable derivation target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditId, documentId, canPersist]);

  const openCount = useMemo(() => notes.filter((note) => note.status === "OPEN").length, [notes]);

  if (!canPersist) {
    return (
      <section className="border border-[rgba(1,30,65,0.14)] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(1,30,65,0.05)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Review notes</p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Review notes are tracked on saved live audits. Open this workpaper in a live audit to raise and address notes.
        </p>
      </section>
    );
  }

  return (
    <section className="border border-[rgba(1,30,65,0.14)] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(1,30,65,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Review notes</p>
        <StatusBadge status={`${openCount} open`} tone={openCount > 0 ? "warning" : "success"} />
      </div>

      {canAuthor && !canReview && openCount > 0 ? (
        <div className="mt-3 border border-[rgba(245,168,0,0.25)] bg-[rgba(245,168,0,0.08)] px-3 py-2 text-xs font-medium text-[var(--brand-amber-dark)]">
          {openCount} review note{openCount === 1 ? "" : "s"} to address. Reply and mark each one cleared, then resubmit the workpaper.
        </div>
      ) : null}

      {canReview ? (
        <div className="mt-3 border border-black/5 bg-[var(--surface-tint)] p-3">
          <textarea
            value={raiseText}
            onChange={(event) => setRaiseText(event.target.value)}
            rows={3}
            placeholder="Add a review note describing what the preparer needs to fix."
            className="w-full resize-none border border-black/10 bg-white px-3 py-2 text-sm leading-5 text-[var(--foreground)] outline-none"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[11px] text-[var(--muted)]">Assigned to {preparerName || "the workpaper preparer"}.</p>
            <button
              type="button"
              onClick={raiseNote}
              disabled={isPending || raiseText.trim().length === 0}
              className="inline-flex items-center gap-2 rounded-sm bg-[var(--brand-indigo-core)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MessageSquarePlus size={14} />
              Add review note
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-3 grid gap-3">
        {notes.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">No review notes have been raised on this workpaper yet.</p>
        ) : (
          notes.map((note) => {
            const messages = buildThreadMessages(note);
            const canClear = canAuthor && note.status === "OPEN";
            const canClose = canReview && note.status !== "CLOSED";
            const canReopen = canReview && note.status !== "OPEN";

            return (
              <article key={note.id} className="border border-black/10 bg-[#fffdfa]">
                <header className="flex items-start justify-between gap-3 border-b border-black/10 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)]">{note.note}</p>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">
                      Raised by {note.createdByName} - {formatDateTime(note.createdAt)}
                      {note.reopenCount > 0 ? ` - reopened ${note.reopenCount}x` : ""}
                    </p>
                  </div>
                  <StatusBadge status={formatNoteStatus(note.status)} tone={noteTone(note.status)} />
                </header>

                {messages.length > 0 ? (
                  <ul className="grid gap-2 px-3 py-2">
                    {messages.map((message) => (
                      <li key={message.id} className="text-[12px] leading-5">
                        <span className="font-semibold text-[var(--foreground)]">{message.label}</span>
                        <span className="text-[var(--muted)]"> - {formatDateTime(message.createdAt)}</span>
                        {message.body ? <p className="text-[var(--foreground)]">{message.body}</p> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {note.status !== "CLOSED" || canReopen ? (
                  <div className="border-t border-black/10 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1 text-[11px] text-[var(--muted)]">
                      {note.clearedAt ? <span>Cleared {formatDateTime(note.clearedAt)}</span> : null}
                      {note.clearedAt ? (
                        <span className="font-semibold text-[var(--foreground)]">- time to clear {formatHoursSpan(note.createdAt, note.clearedAt)}</span>
                      ) : null}
                    </div>

                    <textarea
                      value={replyByNote[note.id] ?? ""}
                      onChange={(event) => setReplyByNote((current) => ({ ...current, [note.id]: event.target.value }))}
                      rows={2}
                      placeholder="Reply to this note..."
                      className="mt-2 w-full resize-none border border-black/10 bg-white px-3 py-2 text-[13px] leading-5 text-[var(--foreground)] outline-none"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <ActionButton
                        label="Reply"
                        onClick={() => act(note, "reply")}
                        disabled={isPending || (replyByNote[note.id] ?? "").trim().length === 0}
                        variant="ghost"
                      />
                      {canClear ? <ActionButton label="Mark cleared" onClick={() => act(note, "clear")} disabled={isPending} variant="primary" /> : null}
                      {canClose ? <ActionButton label="Close" onClick={() => act(note, "close")} disabled={isPending} variant="primary" /> : null}
                      {canReopen ? <ActionButton label="Reopen" onClick={() => act(note, "reopen")} disabled={isPending} variant="ghost" /> : null}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </section>
  );

  function applyResult(result: NotesResponse) {
    if (result.notes) {
      setNotes(result.notes);
      onNotesChanged?.(result.notes);
    }
    router.refresh();
  }

  function raiseNote() {
    if (!auditId || raiseText.trim().length === 0) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/audits/${auditId}/workpapers/${documentId}/review-notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            note: raiseText.trim(),
            createdByName: activeUser.name,
            createdByUserId: isUuid(activeUser.id) ? activeUser.id : undefined,
            assignedToUserId: isUuid(preparerUserId ?? "") ? preparerUserId : undefined,
            assignedToName: preparerName,
          }),
        });
        const result = (await response.json()) as NotesResponse;
        if (!response.ok) {
          throw new Error(result.error ?? "Unable to add the review note.");
        }
        setRaiseText("");
        applyResult(result);
        showNotification({ title: "Review note added", message: "The preparer now has a note to address.", tone: "success" });
      } catch (error) {
        showNotification({ title: "Could not add note", message: error instanceof Error ? error.message : "Unable to add the review note.", tone: "error" });
      }
    });
  }

  function act(note: ReviewNote, action: "reply" | "clear" | "reopen" | "close") {
    if (!auditId) {
      return;
    }

    const comment = (replyByNote[note.id] ?? "").trim();

    startTransition(async () => {
      try {
        const response = await fetch(`/api/audits/${auditId}/workpapers/${documentId}/review-notes/${note.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            actorName: activeUser.name,
            actorUserId: isUuid(activeUser.id) ? activeUser.id : undefined,
            comment: comment.length > 0 ? comment : undefined,
          }),
        });
        const result = (await response.json()) as NotesResponse;
        if (!response.ok) {
          throw new Error(result.error ?? "Unable to update the review note.");
        }
        setReplyByNote((current) => ({ ...current, [note.id]: "" }));
        applyResult(result);
      } catch (error) {
        showNotification({ title: "Update failed", message: error instanceof Error ? error.message : "Unable to update the review note.", tone: "error" });
      }
    });
  }
}

type ThreadMessage = { id: string; label: string; body: string; createdAt: string };

function buildThreadMessages(note: ReviewNote): ThreadMessage[] {
  return note.events
    .filter((event) => event.action !== "RAISED")
    .map((event) => ({
      id: event.id,
      label: messageLabel(event),
      body: event.comment,
      createdAt: event.createdAt,
    }));
}

function messageLabel(event: ReviewNoteEvent): string {
  switch (event.action) {
    case "COMMENT":
      return `${event.actorName} replied`;
    case "CLEARED":
      return `${event.actorName} marked cleared`;
    case "REOPENED":
      return `${event.actorName} reopened`;
    case "CLOSED":
      return `${event.actorName} closed`;
    default:
      return event.actorName;
  }
}

function ActionButton({
  disabled,
  label,
  onClick,
  variant,
}: {
  disabled?: boolean;
  label: string;
  onClick: () => void;
  variant: "primary" | "ghost";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        variant === "primary"
          ? "rounded-sm bg-[var(--brand-indigo-core)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-60"
          : "rounded-sm border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {label}
    </button>
  );
}

function formatNoteStatus(status: ReviewNoteStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function noteTone(status: ReviewNoteStatus): "neutral" | "warning" | "risk" | "success" {
  switch (status) {
    case "OPEN":
      return "warning";
    case "CLEARED":
      return "neutral";
    case "CLOSED":
      return "success";
    default:
      return "neutral";
  }
}

function formatHoursSpan(from: string, to: string) {
  const hours = (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000;
  if (!Number.isFinite(hours) || hours < 0) {
    return "-";
  }
  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }
  return `${(hours / 24).toFixed(1)}d`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
