create table if not exists business_contacts (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  functional_area text not null,
  contact_name text not null,
  contact_email text null,
  contact_title text null,
  notes text null,
  source_system text not null default 'platform',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_contacts_audit_id on business_contacts (audit_id);
create unique index if not exists idx_business_contacts_audit_area_name on business_contacts (audit_id, functional_area, contact_name);
