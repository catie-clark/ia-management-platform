create table if not exists audit_time_entries (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  control_id uuid null references controls(id) on delete set null,
  user_id uuid not null references users(id) on delete restrict,
  phase text not null check (phase in ('Planning', 'Fieldwork', 'Reporting')),
  entry_date date not null,
  hours numeric(10,2) not null check (hours >= 0),
  source text not null default 'uploaded_csv',
  work_item_reference text null,
  notes text null,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_audit_time_entries_audit_id on audit_time_entries (audit_id);
create index if not exists idx_audit_time_entries_user_id on audit_time_entries (user_id);
create index if not exists idx_audit_time_entries_phase on audit_time_entries (phase);
create index if not exists idx_audit_time_entries_audit_phase on audit_time_entries (audit_id, phase);
