alter table audits
  add column if not exists active_phase text;

update audits
set active_phase = 'Planning'
where active_phase is null;

alter table audits
  alter column active_phase set default 'Planning';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'audits_active_phase_check'
  ) then
    alter table audits
      add constraint audits_active_phase_check
      check (active_phase in ('Planning', 'Fieldwork', 'Reporting'));
  end if;
end
$$;

alter table audits
  alter column active_phase set not null;

update audits
set active_phase = 'Planning'
where lower(trim(name)) = 'testing audit';
