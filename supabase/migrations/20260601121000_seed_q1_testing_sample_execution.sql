-- Backfill demo execution timing for the Q1 Compliance Audit so the Fieldwork
-- test-execution analytics render with realistic data in the demo dataset.
-- Only seeded samples (which already carry PASS/FAIL results) are populated.

with q1_audit as (
  select id
  from audits
  where name = 'Q1 Compliance Audit'
  order by created_at desc
  limit 1
),
sample_rows as (
  select
    s.id as sample_id,
    coalesce(c.assigned_owner_user_id, c.control_owner_user_id) as owner_user_id,
    row_number() over (order by m.control_id, s.display_order, s.id) as seq
  from control_testing_matrix_samples s
  join control_testing_matrices m on m.id = s.matrix_id
  join q1_audit a on a.id = m.audit_id
  join controls c on c.id = m.control_id
)
update control_testing_matrix_samples s
set
  tested_by_user_id = sr.owner_user_id,
  started_at = timestamptz '2026-04-15 13:00:00+00' + (sr.seq * interval '95 minutes'),
  completed_at = timestamptz '2026-04-15 13:00:00+00'
    + (sr.seq * interval '95 minutes')
    + ((35 + (sr.seq % 6) * 12) * interval '1 minute'),
  time_spent_minutes = 30 + (sr.seq % 6) * 15,
  updated_at = now()
from sample_rows sr
where s.id = sr.sample_id;
