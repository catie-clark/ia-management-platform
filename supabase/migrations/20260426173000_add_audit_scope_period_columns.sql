alter table audits
  add column if not exists scope_period_start date,
  add column if not exists scope_period_end date;

update audits
set
  scope_period_start = coalesce(scope_period_start, period_start),
  scope_period_end = coalesce(scope_period_end, period_end)
where scope_period_start is null or scope_period_end is null;

alter table audits
  alter column scope_period_start set not null,
  alter column scope_period_end set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'audits_scope_period_check'
  ) then
    alter table audits
      add constraint audits_scope_period_check
      check (scope_period_end >= scope_period_start);
  end if;
end
$$;

create index if not exists idx_audits_scope_period_start on audits (scope_period_start);
