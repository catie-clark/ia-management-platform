insert into users (full_name, email, role, team)
values
  ('Jordan Lee', 'jordan.lee@mfcorp.com', 'AIC', 'Internal Audit'),
  ('Elena Martin', 'elena.martin@mfcorp.com', 'MANAGER', 'Internal Audit'),
  ('Marcus Kim', 'marcus.kim@mfcorp.com', 'DIRECTOR', 'Internal Audit'),
  ('Priya Shah', 'priya.shah@mfcorp.com', 'STAFF', 'Internal Audit'),
  ('Mia Chen', 'mia.chen@mfcorp.com', 'STAFF', 'Internal Audit'),
  ('Noah Bennett', 'noah.bennett@mfcorp.com', 'STAFF', 'Internal Audit'),
  ('Sofia Ramirez', 'sofia.ramirez@mfcorp.com', 'STAFF', 'Internal Audit')
on conflict (email) do update
set
  full_name = excluded.full_name,
  role = excluded.role,
  team = excluded.team,
  active = true;

with q1_audit as (
  select id
  from audits
  where name = 'Q1 Compliance Audit'
  order by created_at desc
  limit 1
),
staff_pool as (
  select
    id,
    row_number() over (order by full_name) as row_num
  from users
  where email in (
    'priya.shah@mfcorp.com',
    'mia.chen@mfcorp.com',
    'noah.bennett@mfcorp.com',
    'sofia.ramirez@mfcorp.com'
  )
),
ranked_controls as (
  select
    control.id,
    row_number() over (order by coalesce(control.source_record_key, control.id::text)) as row_num
  from controls control
  join q1_audit audit
    on audit.id = control.audit_id
),
assigned_controls as (
  select
    ranked.id as control_id,
    staff.id as staff_user_id,
    case when ranked.row_num in (4, 7) then 'OUT_OF_SCOPE' else 'IN_SCOPE' end as scope_status
  from ranked_controls ranked
  join staff_pool staff
    on ((ranked.row_num - 1) % greatest((select count(*) from staff_pool), 1)) + 1 = staff.row_num
)
update controls control
set
  control_owner_user_id = assigned.staff_user_id,
  assigned_owner_user_id = assigned.staff_user_id,
  scope_status = assigned.scope_status,
  source_payload = jsonb_set(
    jsonb_set(coalesce(control.source_payload, '{}'::jsonb), '{scope_status}', to_jsonb(assigned.scope_status::text), true),
    '{scopeStatus}',
    to_jsonb(assigned.scope_status::text),
    true
  )
from assigned_controls assigned
where control.id = assigned.control_id;

with q1_audit as (
  select id
  from audits
  where name = 'Q1 Compliance Audit'
  order by created_at desc
  limit 1
)
update audit_documents document
set owner_user_id = coalesce(control.assigned_owner_user_id, control.control_owner_user_id)
from controls control, q1_audit audit
where document.audit_id = audit.id
  and control.id = document.control_id
  and control.audit_id = audit.id
  and document.document_type in ('WORKPAPER', 'EVIDENCE');
