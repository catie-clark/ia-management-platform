-- Budget-to-actual hours by individual control test (requirement 2b)
-- Each testing matrix (control test) can carry a budgeted-hours figure.
-- Actual hours are derived from per-sample logged effort (see 20260601120000).

alter table control_testing_matrices
  add column if not exists budgeted_hours numeric(8, 2) null;
