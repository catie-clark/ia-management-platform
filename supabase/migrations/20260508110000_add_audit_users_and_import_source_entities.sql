do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    where t.typname = 'source_entity_type'
      and e.enumlabel = 'risk_control_links'
  ) then
    alter type source_entity_type add value 'risk_control_links';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    where t.typname = 'source_entity_type'
      and e.enumlabel = 'users'
  ) then
    alter type source_entity_type add value 'users';
  end if;
end $$;

create table if not exists audit_users (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  audit_role text null,
  is_active boolean not null default true,
  source_import_batch_id uuid null references import_batches(id),
  created_at timestamptz not null default now(),
  unique (audit_id, user_id)
);

create index if not exists idx_audit_users_audit_id on audit_users (audit_id);
create index if not exists idx_audit_users_user_id on audit_users (user_id);

insert into audit_users (audit_id, user_id, audit_role, source_import_batch_id)
select distinct
  controls.audit_id,
  linked_users.user_id,
  null,
  controls.source_import_batch_id
from controls
cross join lateral (
  values
    (controls.control_owner_user_id),
    (controls.assigned_owner_user_id)
) as linked_users(user_id)
where controls.audit_id is not null
  and linked_users.user_id is not null
on conflict (audit_id, user_id) do nothing;
