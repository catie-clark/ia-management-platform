alter table controls
  add column if not exists assigned_owner_user_id uuid null references users(id),
  add column if not exists assigned_due_date date null,
  add column if not exists assigned_planned_hours numeric(10,2) null,
  add column if not exists planning_overridden_at timestamptz null;

create index if not exists idx_controls_assigned_owner_user_id on controls (assigned_owner_user_id);
