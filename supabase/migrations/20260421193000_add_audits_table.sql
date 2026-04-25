create table if not exists audits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  period_start date not null,
  period_end date not null,
  source_system text not null default 'archer',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint audits_period_check check (period_end >= period_start)
);

create index if not exists idx_audits_created_at on audits (created_at desc);
create index if not exists idx_audits_period_start on audits (period_start);

alter table import_batches add column if not exists audit_id uuid null;
alter table import_files add column if not exists audit_id uuid null;
alter table raw_import_rows add column if not exists audit_id uuid null;

alter table applications add column if not exists audit_id uuid null;
alter table third_parties add column if not exists audit_id uuid null;
alter table controls add column if not exists audit_id uuid null;
alter table risks add column if not exists audit_id uuid null;
alter table rcsa_records add column if not exists audit_id uuid null;
alter table issues add column if not exists audit_id uuid null;
alter table monitoring_results add column if not exists audit_id uuid null;
alter table prior_audit_findings add column if not exists audit_id uuid null;
alter table questions add column if not exists audit_id uuid null;
alter table requests add column if not exists audit_id uuid null;
alter table audit_documents add column if not exists audit_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'import_batches_audit_id_fkey'
  ) then
    alter table import_batches
      add constraint import_batches_audit_id_fkey
      foreign key (audit_id) references audits(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'import_files_audit_id_fkey'
  ) then
    alter table import_files
      add constraint import_files_audit_id_fkey
      foreign key (audit_id) references audits(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'raw_import_rows_audit_id_fkey'
  ) then
    alter table raw_import_rows
      add constraint raw_import_rows_audit_id_fkey
      foreign key (audit_id) references audits(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_audit_id_fkey'
  ) then
    alter table applications
      add constraint applications_audit_id_fkey
      foreign key (audit_id) references audits(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'third_parties_audit_id_fkey'
  ) then
    alter table third_parties
      add constraint third_parties_audit_id_fkey
      foreign key (audit_id) references audits(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'controls_audit_id_fkey'
  ) then
    alter table controls
      add constraint controls_audit_id_fkey
      foreign key (audit_id) references audits(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'risks_audit_id_fkey'
  ) then
    alter table risks
      add constraint risks_audit_id_fkey
      foreign key (audit_id) references audits(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rcsa_records_audit_id_fkey'
  ) then
    alter table rcsa_records
      add constraint rcsa_records_audit_id_fkey
      foreign key (audit_id) references audits(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'issues_audit_id_fkey'
  ) then
    alter table issues
      add constraint issues_audit_id_fkey
      foreign key (audit_id) references audits(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'monitoring_results_audit_id_fkey'
  ) then
    alter table monitoring_results
      add constraint monitoring_results_audit_id_fkey
      foreign key (audit_id) references audits(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'prior_audit_findings_audit_id_fkey'
  ) then
    alter table prior_audit_findings
      add constraint prior_audit_findings_audit_id_fkey
      foreign key (audit_id) references audits(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'questions_audit_id_fkey'
  ) then
    alter table questions
      add constraint questions_audit_id_fkey
      foreign key (audit_id) references audits(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'requests_audit_id_fkey'
  ) then
    alter table requests
      add constraint requests_audit_id_fkey
      foreign key (audit_id) references audits(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'audit_documents_audit_id_fkey'
  ) then
    alter table audit_documents
      add constraint audit_documents_audit_id_fkey
      foreign key (audit_id) references audits(id) on delete set null;
  end if;
end
$$;

create index if not exists idx_import_batches_audit_id on import_batches (audit_id);
create index if not exists idx_import_files_audit_id on import_files (audit_id);
create index if not exists idx_raw_import_rows_audit_id on raw_import_rows (audit_id);
create index if not exists idx_applications_audit_id on applications (audit_id);
create index if not exists idx_third_parties_audit_id on third_parties (audit_id);
create index if not exists idx_controls_audit_id on controls (audit_id);
create index if not exists idx_risks_audit_id on risks (audit_id);
create index if not exists idx_rcsa_records_audit_id on rcsa_records (audit_id);
create index if not exists idx_issues_audit_id on issues (audit_id);
create index if not exists idx_monitoring_results_audit_id on monitoring_results (audit_id);
create index if not exists idx_prior_audit_findings_audit_id on prior_audit_findings (audit_id);
create index if not exists idx_questions_audit_id on questions (audit_id);
create index if not exists idx_requests_audit_id on requests (audit_id);
create index if not exists idx_audit_documents_audit_id on audit_documents (audit_id);
