alter table questions
  add column if not exists phase_tag text;

alter table requests
  add column if not exists phase_tag text;

update questions
set phase_tag = coalesce(phase_tag, 'Planning')
where phase_tag is null;

update requests
set phase_tag = coalesce(phase_tag, 'Planning')
where phase_tag is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'questions_phase_tag_check'
  ) then
    alter table questions
      add constraint questions_phase_tag_check
      check (phase_tag in ('Planning', 'Fieldwork', 'Reporting'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'requests_phase_tag_check'
  ) then
    alter table requests
      add constraint requests_phase_tag_check
      check (phase_tag in ('Planning', 'Fieldwork', 'Reporting'));
  end if;
end
$$;

create index if not exists idx_questions_phase_tag on questions (phase_tag);
create index if not exists idx_requests_phase_tag on requests (phase_tag);
