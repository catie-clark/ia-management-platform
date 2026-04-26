create table if not exists audit_findings (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  control_id uuid null references controls(id) on delete set null,
  title text not null,
  summary text not null,
  severity risk_rating not null default 'medium',
  status text not null default 'open',
  owner_user_id uuid null references users(id) on delete set null,
  due_date date null,
  impact_statement text null,
  recommendation text null,
  management_response text null,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint audit_findings_status_check
    check (status in ('open', 'in_progress', 'ready_for_report', 'finalized', 'closed'))
);

create index if not exists idx_audit_findings_audit_id on audit_findings (audit_id);
create index if not exists idx_audit_findings_control_id on audit_findings (control_id);
create index if not exists idx_audit_findings_status on audit_findings (status);

create table if not exists report_review_stages (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  artifact_key text not null,
  stage_order integer not null,
  reviewer_role text not null,
  status text not null default 'pending',
  acted_at timestamptz null,
  acted_by_name text null,
  action_comment text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_review_stages_artifact_key_check
    check (artifact_key in ('FINAL_REPORT', 'REPORTING_TOLLGATE')),
  constraint report_review_stages_reviewer_role_check
    check (reviewer_role in ('AIC', 'STAFF', 'MANAGER', 'DIRECTOR', 'CAE')),
  constraint report_review_stages_status_check
    check (status in ('pending', 'active', 'approved', 'sent_back')),
  constraint report_review_stages_unique_stage
    unique (audit_id, artifact_key, stage_order)
);

create index if not exists idx_report_review_stages_audit_artifact on report_review_stages (audit_id, artifact_key);

create table if not exists report_review_comments (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  artifact_key text not null,
  review_stage_id uuid null references report_review_stages(id) on delete set null,
  author_role text not null,
  author_name text not null,
  comment text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  resolved_by_name text null,
  constraint report_review_comments_artifact_key_check
    check (artifact_key in ('FINAL_REPORT', 'REPORTING_TOLLGATE')),
  constraint report_review_comments_author_role_check
    check (author_role in ('AIC', 'STAFF', 'MANAGER', 'DIRECTOR', 'CAE')),
  constraint report_review_comments_status_check
    check (status in ('open', 'resolved'))
);

create index if not exists idx_report_review_comments_audit_artifact on report_review_comments (audit_id, artifact_key, created_at);
