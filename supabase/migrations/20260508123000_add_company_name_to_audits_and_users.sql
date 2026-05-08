alter table users add column if not exists company_name text null;
alter table audits add column if not exists company_name text null;

update users
set company_name = 'Midwest Community Bank';

update audits
set company_name = 'Midwest Community Bank';

create index if not exists idx_users_company_name on users (company_name);
create index if not exists idx_audits_company_name on audits (company_name);
