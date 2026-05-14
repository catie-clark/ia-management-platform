do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    where t.typname = 'source_entity_type'
      and e.enumlabel = 'rcm'
  ) then
    alter type source_entity_type add value 'rcm';
  end if;
end $$;
