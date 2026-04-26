create table if not exists audit_notifications (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid null references audits(id) on delete cascade,
  recipient_user_id uuid null references users(id) on delete set null,
  recipient_name text not null,
  recipient_role text null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid null,
  title text not null,
  detail text not null,
  link_href text null,
  status text not null default 'unread',
  read_at timestamptz null,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_notifications_status_check check (status in ('unread', 'read'))
);

create index if not exists idx_audit_notifications_recipient_name on audit_notifications (recipient_name);
create index if not exists idx_audit_notifications_recipient_user_id on audit_notifications (recipient_user_id);
create index if not exists idx_audit_notifications_status on audit_notifications (status);
create index if not exists idx_audit_notifications_created_at on audit_notifications (created_at desc);
