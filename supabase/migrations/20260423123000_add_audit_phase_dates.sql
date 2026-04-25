alter table audits add column if not exists planning_start_date date null;
alter table audits add column if not exists planning_end_date date null;
alter table audits add column if not exists fieldwork_start_date date null;
alter table audits add column if not exists fieldwork_end_date date null;
alter table audits add column if not exists reporting_start_date date null;
alter table audits add column if not exists reporting_end_date date null;
