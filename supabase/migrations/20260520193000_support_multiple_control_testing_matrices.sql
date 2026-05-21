alter table control_testing_matrices
add column if not exists display_order integer not null default 1;

with ordered_matrices as (
  select
    id,
    row_number() over (
      partition by audit_id, control_id
      order by created_at, id
    ) as next_display_order
  from control_testing_matrices
)
update control_testing_matrices matrix
set display_order = ordered_matrices.next_display_order
from ordered_matrices
where matrix.id = ordered_matrices.id;

alter table control_testing_matrices
drop constraint if exists control_testing_matrices_audit_id_control_id_key;

alter table control_testing_matrices
add constraint control_testing_matrices_audit_control_display_order_key
unique (audit_id, control_id, display_order);

create index if not exists idx_control_testing_matrices_control_order
on control_testing_matrices (audit_id, control_id, display_order);
