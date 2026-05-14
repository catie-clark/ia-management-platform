alter table audits
add column if not exists admin_settings jsonb not null default '{}'::jsonb;
