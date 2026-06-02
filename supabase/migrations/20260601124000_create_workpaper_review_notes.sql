-- Review notes as first-class discussion threads (requirement 6d)
-- A reviewer raises one or more notes when sending a workpaper back. Each note is
-- a thread: the initial note plus a stream of events (replies + status changes).
-- Lifecycle: OPEN (reviewer raised) -> CLEARED (tester addressed) -> CLOSED
-- (reviewer accepted); a reviewer can reopen a note (-> OPEN). Timestamps drive
-- time-to-clear (raised -> cleared) and time-to-close (cleared -> closed) analytics.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'review_note_status') then
    create type review_note_status as enum ('OPEN', 'CLEARED', 'CLOSED');
  end if;
end
$$;

create table if not exists workpaper_review_notes (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  document_id uuid not null references audit_documents(id) on delete cascade,
  status review_note_status not null default 'OPEN',
  note text not null,
  created_by_user_id uuid null references users(id) on delete set null,
  created_by_name text not null default 'Reviewer',
  assigned_to_user_id uuid null references users(id) on delete set null,
  assigned_to_name text not null default '',
  reopen_count integer not null default 0,
  created_at timestamptz not null default now(),
  cleared_at timestamptz null,
  closed_at timestamptz null,
  last_activity_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workpaper_review_note_events (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references workpaper_review_notes(id) on delete cascade,
  action text not null,
  actor_name text not null default '',
  actor_user_id uuid null references users(id) on delete set null,
  comment text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_workpaper_review_notes_audit on workpaper_review_notes (audit_id);
create index if not exists idx_workpaper_review_notes_document on workpaper_review_notes (document_id);
create index if not exists idx_workpaper_review_notes_status on workpaper_review_notes (status);
create index if not exists idx_workpaper_review_note_events_note on workpaper_review_note_events (note_id, created_at);
