alter table controls
  add column if not exists scope_status text not null default 'IN_SCOPE';

update controls
set scope_status = coalesce(nullif(source_payload->>'scope_status', ''), scope_status, 'IN_SCOPE');

create index if not exists idx_controls_scope_status on controls (scope_status);
