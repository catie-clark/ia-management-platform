do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'testing_matrix_result'
  ) then
    create type testing_matrix_result as enum ('PASS', 'FAIL', 'NOT_TESTED');
  end if;
end
$$;

create table if not exists control_testing_matrices (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  control_id uuid not null references controls(id) on delete cascade,
  title text not null default 'Testing Matrix',
  population_description text not null default '',
  population_size integer null,
  sample_description text not null default '',
  sample_size integer null,
  conclusion text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (audit_id, control_id)
);

create table if not exists control_testing_matrix_attributes (
  id uuid primary key default gen_random_uuid(),
  matrix_id uuid not null references control_testing_matrices(id) on delete cascade,
  attribute_key text not null,
  label text not null,
  guidance text not null default '',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (matrix_id, attribute_key)
);

create table if not exists control_testing_matrix_samples (
  id uuid primary key default gen_random_uuid(),
  matrix_id uuid not null references control_testing_matrices(id) on delete cascade,
  sample_identifier text not null,
  sample_description text not null default '',
  source_reference text not null default '',
  exception_noted text not null default '',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (matrix_id, sample_identifier)
);

create table if not exists control_testing_matrix_results (
  id uuid primary key default gen_random_uuid(),
  matrix_id uuid not null references control_testing_matrices(id) on delete cascade,
  sample_id uuid not null references control_testing_matrix_samples(id) on delete cascade,
  attribute_id uuid not null references control_testing_matrix_attributes(id) on delete cascade,
  result testing_matrix_result not null default 'NOT_TESTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sample_id, attribute_id)
);

create index if not exists idx_control_testing_matrices_audit_id on control_testing_matrices (audit_id);
create index if not exists idx_control_testing_matrices_control_id on control_testing_matrices (control_id);
create index if not exists idx_control_testing_matrix_attributes_matrix_id on control_testing_matrix_attributes (matrix_id, display_order);
create index if not exists idx_control_testing_matrix_samples_matrix_id on control_testing_matrix_samples (matrix_id, display_order);
create index if not exists idx_control_testing_matrix_results_matrix_id on control_testing_matrix_results (matrix_id);

with q1_audit as (
  select id
  from audits
  where name = 'Q1 Compliance Audit'
  order by created_at desc
  limit 1
),
matrix_templates as (
  select
    audit.id as audit_id,
    control.id as control_id,
    concat(control.control_name, ' Testing Matrix') as title,
    case control.control_name
      when 'User Access Review' then 'Population includes all quarterly access review certifications completed for in-scope retail banking platforms during the audit period.'
      when 'Change Management Approval' then 'Population includes all production changes deployed during the audit period for systems in scope.'
      when 'Vendor Settlement Monitoring' then 'Population includes all daily settlement monitoring reviews and reconciled exception items during the audit period.'
      when 'Loan Boarding Quality Assurance' then 'Population includes all newly boarded loans during the audit period that required setup and approval quality checks.'
      when 'Sanctions Alert Triage' then 'Population includes all sanctions alerts dispositioned during the audit period for the monitored compliance queue.'
      when 'Third-Party Due Diligence Review' then 'Population includes all critical vendors subject to annual due diligence review during the audit period.'
      when 'Suspicious Activity Case Escalation' then 'Population includes all high-risk alert investigations requiring escalation within the audit period.'
      when 'Data Retention Exception Monitoring' then 'Population includes all open data retention exceptions tracked during the audit period.'
      when 'Wire Transfer Callback Validation' then 'Population includes all high-value outgoing wire transfers that required callback verification during the audit period.'
      else concat('Population includes all items subject to ', control.control_name, ' during the audit period.')
    end as population_description,
    case control.control_name
      when 'User Access Review' then 62
      when 'Change Management Approval' then 44
      when 'Vendor Settlement Monitoring' then 58
      when 'Loan Boarding Quality Assurance' then 71
      when 'Sanctions Alert Triage' then 96
      when 'Third-Party Due Diligence Review' then 28
      when 'Suspicious Activity Case Escalation' then 34
      when 'Data Retention Exception Monitoring' then 49
      when 'Wire Transfer Callback Validation' then 53
      else greatest(coalesce(control.testing_sample_size, 3) * 10, 25)
    end as population_size,
    case control.control_name
      when 'User Access Review' then 'Selected a representative sample across privileged, terminated, and standard-user recertifications.'
      when 'Change Management Approval' then 'Selected changes across emergency, routine, and high-risk deployments to evaluate approval timing and evidence completeness.'
      when 'Vendor Settlement Monitoring' then 'Selected monitoring dates and related exception items across the period to evaluate timely review and escalation.'
      when 'Loan Boarding Quality Assurance' then 'Selected boarded loans from multiple product types to verify setup accuracy and approval evidence.'
      when 'Sanctions Alert Triage' then 'Selected alerts across severity tiers to test timeliness, reviewer authorization, and disposition support.'
      when 'Third-Party Due Diligence Review' then 'Selected critical vendors from the annual review universe to test completion and approval of due diligence packages.'
      when 'Suspicious Activity Case Escalation' then 'Selected high-risk investigations from across the period to verify escalation timing and documentation.'
      when 'Data Retention Exception Monitoring' then 'Selected open retention exceptions to evaluate monitoring cadence, escalation, and remediation tracking.'
      when 'Wire Transfer Callback Validation' then 'Selected high-value outgoing wires to verify callback completion, timing, and authorized validation.'
      else concat('Selected representative sample items to test whether ', control.control_name, ' operated as designed.')
    end as sample_description,
    greatest(coalesce(control.testing_sample_size, 3), 3) as sample_size,
    case
      when control.status = 'complete' then 'Seeded matrix indicates testing is substantially complete; update sample-level results as needed.'
      when control.status in ('in_progress', 'aic_review', 'manager_review', 'director_review') then 'Seeded matrix is ready for active testing; update conclusions after evaluating all sample items.'
      else 'Seeded matrix is ready for planned testing; complete attribute results and conclusion in the dashboard.'
    end as conclusion,
    case control.control_name
      when 'User Access Review' then jsonb_build_array(
        jsonb_build_object('key', 'review_completed', 'label', 'Was the access review completed for the population item?', 'guidance', 'Confirm the certification was performed for the sampled user or entitlement set.'),
        jsonb_build_object('key', 'reviewer_authorized', 'label', 'Was the reviewer an authorized individual?', 'guidance', 'Validate reviewer authority for the application or entitlement reviewed.'),
        jsonb_build_object('key', 'evidence_retained', 'label', 'Was review evidence retained?', 'guidance', 'Confirm support shows the review outcome and sign-off.')
      )
      when 'Change Management Approval' then jsonb_build_array(
        jsonb_build_object('key', 'approval_obtained', 'label', 'Was change approval obtained?', 'guidance', 'Confirm the sampled change has required approval evidence.'),
        jsonb_build_object('key', 'approval_before_deploy', 'label', 'Was approval obtained before deployment?', 'guidance', 'Validate timing of approval relative to deployment.'),
        jsonb_build_object('key', 'ticket_support_complete', 'label', 'Was ticket documentation complete?', 'guidance', 'Confirm testing, ticket linkage, and implementation evidence are retained.')
      )
      when 'Vendor Settlement Monitoring' then jsonb_build_array(
        jsonb_build_object('key', 'review_performed', 'label', 'Was settlement monitoring performed for the sampled item/date?', 'guidance', 'Confirm daily monitoring evidence exists.'),
        jsonb_build_object('key', 'exceptions_escalated', 'label', 'Were exceptions escalated when identified?', 'guidance', 'Validate issues were escalated according to procedure.'),
        jsonb_build_object('key', 'reconciliation_supported', 'label', 'Was reconciliation support retained?', 'guidance', 'Confirm evidence supports review and resolution.')
      )
      when 'Loan Boarding Quality Assurance' then jsonb_build_array(
        jsonb_build_object('key', 'setup_complete', 'label', 'Was the loan setup complete and accurate?', 'guidance', 'Confirm key setup fields agree to approved source records.'),
        jsonb_build_object('key', 'approval_documented', 'label', 'Was approval documented?', 'guidance', 'Validate preparer/reviewer approval evidence is retained.'),
        jsonb_build_object('key', 'qa_before_release', 'label', 'Was quality assurance completed before release?', 'guidance', 'Check timing of QA relative to loan release or activation.')
      )
      when 'Sanctions Alert Triage' then jsonb_build_array(
        jsonb_build_object('key', 'triage_completed', 'label', 'Was the alert triaged?', 'guidance', 'Confirm disposition review was completed for the sampled alert.'),
        jsonb_build_object('key', 'timely_escalation', 'label', 'Was escalation timely when required?', 'guidance', 'Validate escalation met policy timing requirements.'),
        jsonb_build_object('key', 'authorized_reviewer', 'label', 'Was the reviewer authorized?', 'guidance', 'Confirm the analyst or approver had appropriate authority.')
      )
      when 'Third-Party Due Diligence Review' then jsonb_build_array(
        jsonb_build_object('key', 'package_complete', 'label', 'Was the due diligence package complete?', 'guidance', 'Confirm all required due diligence artifacts were present.'),
        jsonb_build_object('key', 'review_approved', 'label', 'Was the review approved?', 'guidance', 'Validate approval evidence for the annual vendor review.'),
        jsonb_build_object('key', 'review_current', 'label', 'Was the review completed within the required period?', 'guidance', 'Check the annual review was current for the audit period.')
      )
      when 'Suspicious Activity Case Escalation' then jsonb_build_array(
        jsonb_build_object('key', 'case_escalated', 'label', 'Was the case escalated when criteria were met?', 'guidance', 'Confirm escalation occurred for sampled high-risk investigations.'),
        jsonb_build_object('key', 'escalation_timely', 'label', 'Was escalation completed within policy timelines?', 'guidance', 'Check timing from investigation trigger to escalation.'),
        jsonb_build_object('key', 'documentation_complete', 'label', 'Was escalation documentation complete?', 'guidance', 'Validate rationale, support, and final disposition are retained.')
      )
      when 'Data Retention Exception Monitoring' then jsonb_build_array(
        jsonb_build_object('key', 'exception_logged', 'label', 'Was the retention exception logged?', 'guidance', 'Confirm the exception appears in the monitoring inventory.'),
        jsonb_build_object('key', 'follow_up_timely', 'label', 'Was follow-up performed timely?', 'guidance', 'Validate ongoing follow-up met required cadence.'),
        jsonb_build_object('key', 'escalation_supported', 'label', 'Was escalation supported where required?', 'guidance', 'Confirm overdue or critical exceptions were escalated with evidence.')
      )
      when 'Wire Transfer Callback Validation' then jsonb_build_array(
        jsonb_build_object('key', 'callback_completed', 'label', 'Was the callback completed?', 'guidance', 'Confirm callback evidence exists for the sampled wire.'),
        jsonb_build_object('key', 'callback_before_release', 'label', 'Was the callback completed before release?', 'guidance', 'Validate callback timing relative to wire release.'),
        jsonb_build_object('key', 'validator_authorized', 'label', 'Was the validator authorized?', 'guidance', 'Confirm the callback or approval was performed by an authorized party.')
      )
      else jsonb_build_array(
        jsonb_build_object('key', 'control_executed', 'label', 'Was the control executed?', 'guidance', 'Confirm the control operated for the sampled item.'),
        jsonb_build_object('key', 'timing_met', 'label', 'Was the control performed timely?', 'guidance', 'Validate the control was completed within required timing.'),
        jsonb_build_object('key', 'evidence_retained', 'label', 'Was evidence retained?', 'guidance', 'Confirm support exists for the sampled item.')
      )
    end as attributes_json,
    case
      when control.control_name in ('Sanctions Alert Triage', 'Suspicious Activity Case Escalation', 'Data Retention Exception Monitoring') then 2
      else 0
    end as fail_sample_order,
    case
      when control.control_name in ('Sanctions Alert Triage', 'Suspicious Activity Case Escalation', 'Data Retention Exception Monitoring') then 2
      else 0
    end as fail_attribute_order
  from q1_audit audit
  join controls control
    on control.audit_id = audit.id
),
inserted_matrices as (
  insert into control_testing_matrices (
    audit_id,
    control_id,
    title,
    population_description,
    population_size,
    sample_description,
    sample_size,
    conclusion
  )
  select
    template.audit_id,
    template.control_id,
    template.title,
    template.population_description,
    template.population_size,
    template.sample_description,
    template.sample_size,
    template.conclusion
  from matrix_templates template
  on conflict (audit_id, control_id) do update
  set
    title = excluded.title,
    population_description = excluded.population_description,
    population_size = excluded.population_size,
    sample_description = excluded.sample_description,
    sample_size = excluded.sample_size,
    conclusion = excluded.conclusion,
    updated_at = now()
  returning id, audit_id, control_id
),
matrix_context as (
  select
    matrix.id as matrix_id,
    template.audit_id,
    template.control_id,
    template.sample_size,
    template.attributes_json,
    template.fail_sample_order,
    template.fail_attribute_order
  from inserted_matrices matrix
  join matrix_templates template
    on template.audit_id = matrix.audit_id
   and template.control_id = matrix.control_id
),
inserted_attributes as (
  insert into control_testing_matrix_attributes (
    matrix_id,
    attribute_key,
    label,
    guidance,
    display_order
  )
  select
    context.matrix_id,
    attribute.value->>'key',
    attribute.value->>'label',
    coalesce(attribute.value->>'guidance', ''),
    attribute.ordinality::integer
  from matrix_context context
  cross join lateral jsonb_array_elements(context.attributes_json) with ordinality as attribute(value, ordinality)
  on conflict (matrix_id, attribute_key) do update
  set
    label = excluded.label,
    guidance = excluded.guidance,
    display_order = excluded.display_order,
    updated_at = now()
  returning id, matrix_id, display_order
),
inserted_samples as (
  insert into control_testing_matrix_samples (
    matrix_id,
    sample_identifier,
    sample_description,
    source_reference,
    exception_noted,
    display_order
  )
  select
    context.matrix_id,
    concat('S-', lpad(sample_number::text, 2, '0')),
    concat('Sample item ', lpad(sample_number::text, 2, '0'), ' selected from the testing population.'),
    concat('Population reference ', lpad(sample_number::text, 2, '0')),
    case
      when context.fail_sample_order = sample_number then 'Exception noted: sampled item failed a key attribute and requires follow-up.'
      else ''
    end,
    sample_number
  from matrix_context context
  cross join lateral generate_series(1, context.sample_size) as sample_number
  on conflict (matrix_id, sample_identifier) do update
  set
    sample_description = excluded.sample_description,
    source_reference = excluded.source_reference,
    exception_noted = excluded.exception_noted,
    display_order = excluded.display_order,
    updated_at = now()
  returning id, matrix_id, display_order
)
insert into control_testing_matrix_results (
  matrix_id,
  sample_id,
  attribute_id,
  result
)
select
  context.matrix_id,
  sample.id,
  attribute.id,
  case
    when context.fail_sample_order = sample.display_order and context.fail_attribute_order = attribute.display_order then 'FAIL'::testing_matrix_result
    else 'PASS'::testing_matrix_result
  end
from matrix_context context
join inserted_samples sample
  on sample.matrix_id = context.matrix_id
join inserted_attributes attribute
  on attribute.matrix_id = context.matrix_id
on conflict (sample_id, attribute_id) do update
set
  result = excluded.result,
  updated_at = now();
