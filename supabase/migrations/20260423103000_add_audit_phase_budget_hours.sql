alter table audits add column if not exists planning_budget_hours numeric(10,2) null;
alter table audits add column if not exists fieldwork_budget_hours numeric(10,2) null;
alter table audits add column if not exists reporting_budget_hours numeric(10,2) null;
