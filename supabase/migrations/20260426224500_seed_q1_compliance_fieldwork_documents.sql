with q1_audit as (
  select id, period_end
  from audits
  where name = 'Q1 Compliance Audit'
  order by created_at desc
  limit 1
),
workpaper_seed as (
  insert into audit_documents (
    audit_id,
    source_system,
    source_record_key,
    document_type,
    title,
    control_id,
    owner_user_id,
    status,
    due_date,
    template_name,
    source_payload
  )
  select
    audit.id,
    'platform',
    concat('q1-fieldwork-workpaper-', coalesce(control.source_record_key, control.id::text)),
    'WORKPAPER',
    concat(control.control_name, ' Workpaper'),
    control.id,
    coalesce(control.assigned_owner_user_id, control.control_owner_user_id),
    case
      when control.status = 'complete' then 'complete'::document_status
      when control.status in ('in_progress', 'aic_review', 'manager_review', 'director_review') then 'in_progress'::document_status
      else 'not_started'::document_status
    end,
    coalesce(control.assigned_due_date, control.due_date, audit.period_end),
    'Fieldwork Workpaper Template',
    jsonb_build_object(
      'preview_summary', concat('Fieldwork workpaper for ', control.control_name, ' prepared in the platform.'),
      'preview_sections', jsonb_build_array(
        jsonb_build_object(
          'heading', 'Objective',
          'body', jsonb_build_array(concat('Document the fieldwork performed over ', control.control_name, '.'))
        ),
        jsonb_build_object(
          'heading', 'Scope and Population',
          'body', jsonb_build_array('Capture the in-scope population, selection rationale, and linked support in this workpaper.')
        ),
        jsonb_build_object(
          'heading', 'Procedures Performed',
          'body', jsonb_build_array('Record walkthroughs, sample execution, and evidence inspection directly in the app.')
        )
      ),
      'review_status',
      case
        when control.status = 'complete' then 'APPROVED'
        else 'NOT_SUBMITTED'
      end,
      'workpaper_content', jsonb_build_object(
        'summary', concat('Fieldwork workpaper for ', control.control_name, '.'),
        'objective', concat('Assess the design and operating effectiveness of ', control.control_name, '.'),
        'scope', 'Populate the relevant sample, timing window, and support population in this section.',
        'procedures', 'Record the detailed fieldwork procedures completed for this control.',
        'results', 'Summarize the work performed, exceptions identified, and support received.',
        'conclusion', 'State the workpaper conclusion once testing is complete.',
        'next_steps', 'Track any follow-up needed before the workpaper can move through review.'
      )
    )
  from q1_audit audit
  join controls control
    on control.audit_id = audit.id
  where not exists (
    select 1
    from audit_documents document
    where document.audit_id = audit.id
      and document.document_type = 'WORKPAPER'
      and document.control_id = control.id
  )
  on conflict (source_record_key) do nothing
  returning 1
),
evidence_seed as (
  insert into audit_documents (
    audit_id,
    source_system,
    source_record_key,
    document_type,
    title,
    control_id,
    question_id,
    request_id,
    owner_user_id,
    status,
    due_date,
    template_name,
    source_payload
  )
  select
    audit.id,
    'platform',
    concat('q1-fieldwork-evidence-', request.id::text),
    'EVIDENCE',
    concat('Support - ', left(request.description, 80)),
    request.control_id,
    question.id,
    request.id,
    coalesce(control.assigned_owner_user_id, control.control_owner_user_id),
    case
      when request.status = 'completed' then 'complete'::document_status
      when request.status = 'in_progress' then 'in_progress'::document_status
      else 'not_started'::document_status
    end,
    coalesce(request.due_date, control.assigned_due_date, control.due_date, audit.period_end),
    'Fieldwork Evidence Support',
    jsonb_build_object(
      'preview_summary', concat('Evidence support item linked to request: ', request.description),
      'preview_sections', jsonb_build_array(
        jsonb_build_object(
          'heading', 'Requested Support',
          'body', jsonb_build_array(request.description)
        ),
        jsonb_build_object(
          'heading', 'Fieldwork Relevance',
          'body', jsonb_build_array('Use this evidence row to track the support needed to complete linked fieldwork procedures.')
        )
      ),
      'review_status',
      case
        when request.status = 'completed' then 'APPROVED'
        else 'NOT_SUBMITTED'
      end
    )
  from q1_audit audit
  join requests request
    on request.audit_id = audit.id
  left join controls control
    on control.id = request.control_id
  left join questions question
    on question.audit_id = audit.id
   and question.control_id = request.control_id
  where not exists (
    select 1
    from audit_documents document
    where document.audit_id = audit.id
      and document.document_type = 'EVIDENCE'
      and document.request_id = request.id
  )
  on conflict (source_record_key) do nothing
  returning 1
)
select
  (select count(*) from workpaper_seed) as workpapers_inserted,
  (select count(*) from evidence_seed) as evidence_inserted;
