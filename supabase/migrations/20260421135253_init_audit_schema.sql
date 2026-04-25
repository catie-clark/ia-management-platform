create extension if not exists pgcrypto;

create type import_status as enum ('uploaded', 'parsed', 'validated', 'loaded', 'failed');
create type yes_no as enum ('yes', 'no');
create type control_status as enum ('not_started', 'in_progress', 'aic_review', 'manager_review', 'director_review', 'complete');
create type question_status as enum ('open', 'responded', 'overdue');
create type request_status as enum ('open', 'in_progress', 'completed');
create type document_status as enum ('not_started', 'in_progress', 'complete');
create type risk_rating as enum ('low', 'medium', 'high');
create type source_entity_type as enum (
  'applications', 'third_parties', 'controls', 'risks', 'rcsa_records', 'issues',
  'monitoring_results', 'prior_audit_findings', 'questions', 'requests', 'documents'
);



create table if not exists import_batches (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'archer',
  uploaded_by uuid null,
  uploaded_at timestamptz not null default now(),
  zip_object_path text null,
  original_file_name text null,
  file_sha256 text null,
  archive_metadata jsonb not null default '{}'::jsonb,
  status import_status not null default 'uploaded',
  row_count integer not null default 0,
  parse_errors jsonb not null default '[]'::jsonb,
  notes text null
);

create table if not exists import_files (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references import_batches(id) on delete cascade,
  source_entity source_entity_type not null,
  file_name text not null,
  sheet_name text null,
  file_sha256 text null,
  row_count integer not null default 0,
  header_row jsonb not null default '[]'::jsonb,
  parsed_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists raw_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_file_id uuid not null references import_files(id) on delete cascade,
  row_number integer not null,
  source_record_key text null,
  raw_payload jsonb not null,
  validation_status text not null default 'pending',
  validation_errors jsonb not null default '[]'::jsonb,
  cleaned_entity_table text null,
  cleaned_entity_id uuid null,
  created_at timestamptz not null default now(),
  unique (import_file_id, row_number)
);

create index if not exists idx_raw_import_rows_payload_gin on raw_import_rows using gin (raw_payload);
create index if not exists idx_raw_import_rows_source_record_key on raw_import_rows (source_record_key);

-- =============
-- Master reference tables
-- =============
create table if not exists business_units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  role text not null,
  team text null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =============
-- Cleaned domain tables
-- =============
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'archer',
  source_record_key text not null unique,
  application_name text not null,
  business_unit_id uuid null references business_units(id),
  criticality text null,
  hosting_model text null,
  application_owner_user_id uuid null references users(id),
  lifecycle_status text null,
  vendor_name text null,
  last_risk_review date null,
  last_refreshed date null,
  known_control_gaps boolean not null default false,
  source_import_batch_id uuid null references import_batches(id),
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists third_parties (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'archer',
  source_record_key text not null unique,
  third_party_name text not null,
  service_category text null,
  criticality text null,
  control_attestation text null,
  business_unit_id uuid null references business_units(id),
  vendor_owner_user_id uuid null references users(id),
  lifecycle_status text null,
  last_review_date date null,
  contract_renewal_date date null,
  open_issues_count integer not null default 0,
  source_import_batch_id uuid null references import_batches(id),
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists controls (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'archer',
  source_record_key text not null unique,
  control_name text not null,
  business_unit_id uuid null references business_units(id),
  control_owner_user_id uuid null references users(id),
  status control_status not null default 'not_started',
  due_date date null,
  planned_hours numeric(10,2) not null default 0,
  actual_hours numeric(10,2) not null default 0,
  risk_rating risk_rating not null default 'medium',
  primary_application_id uuid null references applications(id),
  third_party_id uuid null references third_parties(id),
  control_frequency text null,
  testing_sample_size integer null,
  source_import_batch_id uuid null references import_batches(id),
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists risks (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'archer',
  source_record_key text not null unique,
  risk_statement text not null,
  business_unit_id uuid null references business_units(id),
  inherent_likelihood text null,
  inherent_impact text null,
  inherent_risk_rating risk_rating not null default 'medium',
  residual_risk_rating risk_rating not null default 'medium',
  risk_owner_user_id uuid null references users(id),
  status text not null,
  last_reviewed date null,
  next_review_date date null,
  source_import_batch_id uuid null references import_batches(id),
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists risk_control_links (
  id uuid primary key default gen_random_uuid(),
  risk_id uuid not null references risks(id) on delete cascade,
  control_id uuid not null references controls(id) on delete cascade,
  relation_type text not null default 'mitigates',
  link_strength text null,
  created_at timestamptz not null default now(),
  unique (risk_id, control_id, relation_type)
);


create table if not exists rcsa_records (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'archer',
  source_record_key text not null unique,
  business_unit_id uuid null references business_units(id),
  risk_statement text not null,
  residual_risk_rating risk_rating not null default 'medium',
  key_controls text[] not null default '{}',
  last_reviewed date null,
  risk_owner_user_id uuid null references users(id),
  source_import_batch_id uuid null references import_batches(id),
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists issues (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'archer',
  source_record_key text not null unique,
  control_id uuid null references controls(id),
  issue_summary text not null,
  status text not null,
  severity risk_rating not null default 'medium',
  business_unit_id uuid null references business_units(id),
  date_opened date null,
  target_remediation_date date null,
  issue_owner_user_id uuid null references users(id),
  root_cause text null,
  remediation_progress text null,
  source_import_batch_id uuid null references import_batches(id),
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists monitoring_results (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'archer',
  source_record_key text not null unique,
  title text not null,
  business_unit_id uuid null references business_units(id),
  severity risk_rating not null default 'medium',
  summary text not null,
  status text not null,
  run_date date null,
  next_due_date date null,
  analyst_user_id uuid null references users(id),
  source_import_batch_id uuid null references import_batches(id),
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists prior_audit_findings (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'archer',
  source_record_key text not null unique,
  prior_audit_name text not null,
  finding_description text not null,
  status text not null,
  severity risk_rating not null default 'medium',
  business_unit_id uuid null references business_units(id),
  related_control_id uuid null references controls(id),
  issue_date date null,
  open_action_owner_user_id uuid null references users(id),
  source_import_batch_id uuid null references import_batches(id),
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'archer',
  source_record_key text not null unique,
  control_id uuid null references controls(id),
  asked_by_user_id uuid null references users(id),
  assigned_to text not null,
  date_sent date null,
  due_date date null,
  status question_status not null default 'open',
  question_text text not null,
  response_text text null,
  response_date date null,
  source_import_batch_id uuid null references import_batches(id),
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'archer',
  source_record_key text not null unique,
  control_id uuid null references controls(id),
  description text not null,
  requested_from text not null,
  date_requested date null,
  due_date date null,
  status request_status not null default 'open',
  response_notes text null,
  source_import_batch_id uuid null references import_batches(id),
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_documents (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'archer',
  source_record_key text not null unique,
  document_type text not null,
  title text not null,
  control_id uuid null references controls(id),
  question_id uuid null references questions(id),
  request_id uuid null references requests(id),
  owner_user_id uuid null references users(id),
  status document_status not null default 'not_started',
  due_date date null,
  template_name text null,
  source_import_batch_id uuid null references import_batches(id),
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============
-- Optional: normalized link table for generic relationships
-- =============
create table if not exists entity_links (
  id uuid primary key default gen_random_uuid(),
  from_entity_type source_entity_type not null,
  from_entity_id uuid not null,
  to_entity_type source_entity_type not null,
  to_entity_id uuid not null,
  relation_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_controls_business_unit on controls (business_unit_id);
create index if not exists idx_controls_due_date on controls (due_date);
create index if not exists idx_questions_due_date on questions (due_date);
create index if not exists idx_requests_due_date on requests (due_date);
create index if not exists idx_audit_documents_status on audit_documents (status);

-- =============
-- Suggested loading pattern
-- =============
-- 1. Upload ZIP to Supabase Storage (private bucket) and create import_batches row.
-- 2. Parse each CSV into import_files + raw_import_rows.
-- 3. Normalize reference data first (business_units, users).
-- 4. Load applications, third_parties, controls, risks, then downstream tables.
-- 5. Load risk_control_links after controls and risks are available.
-- 6. Keep raw_payload + source_record_key for traceability.
-- 7. Use a validation layer before moving records from raw_import_rows to cleaned tables.
