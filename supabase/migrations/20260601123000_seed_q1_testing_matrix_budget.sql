-- Seed demo budgeted hours per control test for the Q1 Compliance Audit so the
-- budget-to-actual-by-control-test breakdown renders with realistic data.

with q1_audit as (
  select id
  from audits
  where name = 'Q1 Compliance Audit'
  order by created_at desc
  limit 1
),
sample_counts as (
  select m.id as matrix_id, count(s.id) as sample_count
  from control_testing_matrices m
  join q1_audit a on a.id = m.audit_id
  left join control_testing_matrix_samples s on s.matrix_id = m.id
  group by m.id
)
update control_testing_matrices m
set
  budgeted_hours = greatest(round((sc.sample_count * 0.9)::numeric, 2), 2),
  updated_at = now()
from sample_counts sc
where m.id = sc.matrix_id;
