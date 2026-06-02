-- Seed demo review notes for the Q1 Compliance Audit so the consolidated review-note
-- threads and the time analytics render with realistic data.
-- Lifecycle: OPEN (reviewer raised) -> CLEARED (tester) -> CLOSED (reviewer).

with q1_audit as (
  select id from audits where name = 'Q1 Compliance Audit' order by created_at desc limit 1
),
reviewer as (
  select u.id, u.full_name
  from users u
  order by case lower(u.role) when 'director' then 0 when 'manager' then 1 when 'aic' then 2 else 3 end, u.full_name
  limit 1
),
workpapers as (
  select
    d.id as document_id,
    d.owner_user_id,
    row_number() over (order by d.created_at, d.id) as seq
  from audit_documents d
  join q1_audit a on a.id = d.audit_id
  where d.document_type = 'WORKPAPER'
  limit 6
),
seed as (
  select
    w.document_id,
    w.owner_user_id,
    w.seq,
    ou.full_name as owner_name,
    (timestamptz '2026-04-20 14:00:00+00' + (w.seq * interval '7 hours')) as created_at,
    case (w.seq % 3)
      when 0 then 'CLOSED'
      when 2 then 'CLEARED'
      else 'OPEN'
    end as status,
    case when (w.seq % 3) = 0 and w.seq > 1 then 1 else 0 end as reopen_count,
    case (w.seq % 6)
      when 1 then 'Confirm the sample selection methodology is documented and tied to the population.'
      when 2 then 'Tie the exception count in the workpaper to the testing matrix results.'
      when 3 then 'Add the reviewer authorization evidence for sampled item 3.'
      when 4 then 'Clarify the control frequency and the period covered by testing.'
      when 5 then 'Document the rationale for the expected deviation rate used.'
      else 'The conclusion does not yet address the noted exception - please revise.'
    end as note_text
  from workpapers w
  left join users ou on ou.id = w.owner_user_id
),
inserted as (
  insert into workpaper_review_notes (
    audit_id, document_id, status, note,
    created_by_user_id, created_by_name,
    assigned_to_user_id, assigned_to_name,
    reopen_count, created_at, cleared_at, closed_at, last_activity_at, updated_at
  )
  select
    a.id,
    s.document_id,
    s.status::review_note_status,
    s.note_text,
    r.id,
    coalesce(r.full_name, 'Review Lead'),
    s.owner_user_id,
    coalesce(s.owner_name, 'Assigned preparer'),
    s.reopen_count,
    s.created_at,
    case when s.status in ('CLEARED', 'CLOSED') then s.created_at + ((10 + s.seq * 3) * interval '1 hour') else null end,
    case when s.status = 'CLOSED' then s.created_at + ((14 + s.seq * 3) * interval '1 hour') else null end,
    case
      when s.status = 'CLOSED' then s.created_at + ((14 + s.seq * 3) * interval '1 hour')
      when s.status = 'CLEARED' then s.created_at + ((10 + s.seq * 3) * interval '1 hour')
      else s.created_at + interval '2 hours'
    end,
    now()
  from seed s
  cross join q1_audit a
  cross join reviewer r
  returning id, status, created_at, cleared_at, closed_at, created_by_name, assigned_to_name
)
insert into workpaper_review_note_events (note_id, action, actor_name, comment, created_at)
select id, 'RAISED', created_by_name, '', created_at from inserted
union all
select id, 'COMMENT', assigned_to_name, 'Updated the workpaper to address this - please re-check.', created_at + interval '2 hours' from inserted
union all
select id, 'CLEARED', assigned_to_name, 'Marked as addressed.', cleared_at from inserted where cleared_at is not null
union all
select id, 'CLOSED', created_by_name, 'Reviewed and accepted.', closed_at from inserted where closed_at is not null;
