with q1_audit as (
  select id
  from audits
  where name = 'Q1 Compliance Audit'
  order by created_at desc
  limit 1
)
insert into business_contacts (
  audit_id,
  functional_area,
  contact_name,
  contact_email,
  contact_title,
  notes,
  source_system
)
select
  audit.id,
  contact.functional_area,
  contact.contact_name,
  contact.contact_email,
  contact.contact_title,
  contact.notes,
  'platform'
from q1_audit audit
cross join (
  values
    (
      'Compliance',
      'Avery Collins',
      'avery.collins@mfcorp.com',
      'Compliance Director',
      'Primary point of contact for policy interpretation, regulatory exceptions, and walkthrough follow-up.'
    ),
    (
      'IT Operations',
      'Dylan Brooks',
      'dylan.brooks@mfcorp.com',
      'IT Operations Manager',
      'Route infrastructure evidence requests and change management support items here first.'
    ),
    (
      'Treasury',
      'Morgan Patel',
      'morgan.patel@mfcorp.com',
      'Treasury Manager',
      'Owns cash management process questions and supporting reconciliations for the audit period.'
    ),
    (
      'Consumer Lending',
      'Taylor Nguyen',
      'taylor.nguyen@mfcorp.com',
      'Consumer Lending Operations Lead',
      'Coordinate loan operations responses, approval artifacts, and exception explanations through this contact.'
    ),
    (
      'Vendor Management',
      'Casey Rivera',
      'casey.rivera@mfcorp.com',
      'Vendor Governance Lead',
      'Use for third-party oversight documentation, due diligence support, and open risk assessment items.'
    )
) as contact(functional_area, contact_name, contact_email, contact_title, notes)
on conflict (audit_id, functional_area, contact_name) do update
set
  contact_email = excluded.contact_email,
  contact_title = excluded.contact_title,
  notes = excluded.notes,
  source_system = excluded.source_system,
  updated_at = now();
