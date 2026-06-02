-- Test execution time analytics (requirement 6e)
-- Capture, per sample item, who tested it and when, plus optional logged effort.
-- started_at / completed_at are stamped automatically as results are recorded;
-- time_spent_minutes is an optional manual effort entry.

alter table control_testing_matrix_samples
  add column if not exists tested_by_user_id uuid null references users(id) on delete set null,
  add column if not exists started_at timestamptz null,
  add column if not exists completed_at timestamptz null,
  add column if not exists time_spent_minutes integer null;

create index if not exists idx_control_testing_matrix_samples_tested_by
  on control_testing_matrix_samples (tested_by_user_id);

create index if not exists idx_control_testing_matrix_samples_completed_at
  on control_testing_matrix_samples (completed_at);
