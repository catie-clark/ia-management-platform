create table if not exists control_exceptions (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  control_id uuid not null references controls(id) on delete cascade,
  created_by_user_id uuid null references users(id) on delete set null,
  created_by_name text not null,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_control_exceptions_audit_id on control_exceptions (audit_id);
create index if not exists idx_control_exceptions_control_id on control_exceptions (control_id);
create index if not exists idx_control_exceptions_created_at on control_exceptions (created_at desc);
