# Audit Workspace Launch Page Revamp Plan

## Objective

Revamp the original AuditDESK launch page now served at `/audit-intake`. After a user selects either `Launch as Manager` or `Launch as Staff` on `/demo-login`, they should land on a simple Crowe-branded audit workspace index where they can either open an existing active audit or create a new audit workspace.

The current split-card experience should become a cleaner table-first page. The new page should make the two primary actions obvious:

- Open an existing audit from the active audits table.
- Create a new audit from a single `Add new audit workspace` button above the table.

## Current Context

- `/` is now the revamped AuditDESK marketing/demo landing page.
- `/demo-login` is the revamped role selection page.
- `/demo-login` currently routes both Manager and Staff to `/audit-intake`.
- `/audit-intake` currently contains the original create-or-open flow with two large card sections, a select dropdown for existing audits, and a large intake modal.
- `GET /api/audits` already returns the main fields needed for the table:
  - `id`
  - `name`
  - `company_name`
  - `period_start`
  - `period_end`
  - `scope_period_start`
  - `scope_period_end`
  - `total_budget_hours`
  - `planning_budget_hours`
  - `fieldwork_budget_hours`
  - `reporting_budget_hours`
  - `status`
  - `active_phase`
  - `created_at`

## Route Plan

Keep `/audit-intake` as the target route for the revamped page to avoid unnecessary route churn.

Update `/demo-login` only if needed to ensure both role choices continue pointing to `/audit-intake`. If role context becomes useful later, pass it as a query string such as `/audit-intake?role=manager`, but this revamp should not depend on role-specific behavior.

## Page Structure

### Header

Use the same Crowe visual language as the new landing and demo login pages:

- Indigo header band using `--brand-indigo-dark`.
- Crowe logo at top left.
- Small page label such as `Audit workspaces`.
- Primary amber CTA button on the right: `Add new audit workspace`.

Keep the header practical and compact. This should feel like an operational workspace index, not another marketing hero.

### Main Content

Use a clean constrained layout with minimal nested containers:

- Page title: `Audit workspaces`
- Short supporting line: `Open an active audit or create a new workspace.`
- Optional small summary strip above the table:
  - Active audits count
  - Planning count
  - Fieldwork count
  - Reporting count

The summary strip should be lightweight, using text and small accent indicators instead of large cards.

### Active Audits Table

Replace the existing dropdown and selected-audit card with a table of active audits.

Recommended columns:

| Column | Source | Notes |
| --- | --- | --- |
| Audit name | `name` | Primary text. Row click should open the audit. |
| Company | `company_name` | Show only if present, otherwise use default company label. |
| Scope period | `scope_period_start`, `scope_period_end`, fallback to audit period | Format as `MMM D, YYYY - MMM D, YYYY`. |
| Audit timeframe | `period_start`, `period_end` | The full audit period. |
| Current stage | `active_phase` | Use a compact status badge. |
| Status | `status` | Display as a quiet badge, normalized to title case. |
| Budget | `total_budget_hours` | Show `240h` or `Not set`. |
| Created | `created_at` | Optional, useful for sorting and recency. |
| Action | derived link | Explicit `Open` button for clarity. |

The row itself should also be clickable, but keep a visible `Open` button so users do not have to infer the interaction.

### Empty, Loading, and Error States

- Loading: use table skeleton rows, not a large spinner.
- Empty: show a concise empty table state with the same `Add new audit workspace` CTA.
- Error: show a small inline error banner above the table and keep the CTA available.

## Create New Audit Popup

Clicking `Add new audit workspace` should open a modal/popup that captures the same information the current intake captures, but in a cleaner layout.

### Preserve Existing Intake Fields

Keep these fields:

- Audit name
- Audit period start
- Audit period end
- Scope period start
- Scope period end
- Total audit hours
- Import planning hours from prior audit
- File intake mode:
  - Section by section
  - Folder import
- Required controls dataset upload
- Optional uploads:
  - RCM workbook
  - Question log dataset
  - Request log dataset
  - Documents dataset
  - Applications reference data
  - Users directory data
  - Third-party reference data
  - Risk register data
  - Risk-to-control mapping
  - RCSA data
  - Issue tracker data
  - Monitoring results data
  - Prior audit findings

### Modal Redesign

Make the modal feel simpler by reducing nested cards and visual weight:

- Use one clean dialog surface with a sticky header and sticky footer.
- Header: `New audit workspace` plus close button.
- Footer: validation helper text, `Cancel`, and `Create workspace`.
- Body should use a two-step or sectioned layout:
  - `Audit details`
  - `Data upload`

For `Audit details`, use a compact form grid without surrounding cards.

For `Data upload`, use tabs or a segmented control for `Section by section` and `Folder import`. Avoid rendering every optional upload as a large card. Prefer dense rows with:

- Dataset label
- Required or optional badge
- Accepted file type
- Selected file name
- Upload control

For folder import, show one folder picker and a compact mapping review table rather than stacked mapping cards.

### Creation Behavior

On successful creation:

- Close the modal.
- Refresh or locally prepend the new audit in the active audits table.
- Show a small success banner or toast: `Audit workspace created.`
- Do not auto-navigate unless a clear `Open now` affordance is included. The user explicitly asked for the created audit to be added to the row.

## Visual Design Direction

Follow the visual direction of the revamped `/` and `/demo-login` pages, but make this page more utilitarian.

Use Crowe brand tokens from `src/app/globals.css`:

- `--brand-indigo-dark: #011e41`
- `--brand-indigo-core: #002e62`
- `--brand-amber-core: #f5a800`
- `--brand-amber-bright: #ffd231`
- `--brand-teal-core: #05ab8c`
- `--brand-coral: #e5376b`
- `--background: #f6f4ef`
- `--surface: #ffffff`
- `--surface-soft: #fcfbf8`
- `--border-subtle: rgba(1, 30, 65, 0.08)`

Design rules:

- Keep the primary CTA amber.
- Use indigo for structure, headings, and primary text.
- Use teal for positive/completed states.
- Use coral only for validation or error states.
- Avoid heavy gradients except for the top band or very subtle page background.
- Avoid nested cards and large dark information panels on this page.
- Keep border radii tighter than the current page where possible, closer to `16px` for panels and `999px` only for pills/buttons.
- Use lucide icons only where they clarify action, such as `Plus`, `Search`, `FolderOpen`, `ArrowUpRight`, and `X`.

## Interaction Details

- Add table search by audit name and company.
- Add a simple stage filter: `All`, `Planning`, `Fieldwork`, `Reporting`.
- Default sorting should show most recently created audits first.
- Clicking a row or `Open` should navigate to:
  - `/dashboard?mode=live&auditId={id}&auditLabel={name}&companyName={companyName}&scopePeriodLabel={scopePeriod}`
- Preserve the existing dashboard query behavior so `AppShell` continues to show the selected audit context.
- Keep keyboard support:
  - `Esc` closes the modal.
  - Modal focus is trapped while open.
  - The first audit name input receives focus when the modal opens.
  - Table actions are reachable by keyboard.

## Implementation Steps

1. Refactor `/audit-intake` state so audit list loading is table-oriented rather than dropdown-oriented.
2. Create a normalized `AuditWorkspaceRow` view model with formatted scope period, audit timeframe, budget, status, stage, and dashboard URL.
3. Replace the current two large cards with the new header, toolbar, summary strip, and active audits table.
4. Keep the existing create audit submit logic, upload requirement definitions, folder mapping logic, and validation behavior.
5. Redesign `NewAuditModal` into the simpler dialog layout described above.
6. After successful create, reload `GET /api/audits` or prepend the created audit to the table if the response contains enough detail.
7. Ensure Manager and Staff selections on `/demo-login` route to the revamped `/audit-intake` page.
8. Verify responsive behavior:
   - Desktop: full table.
   - Tablet: table remains horizontally scrollable if needed.
   - Mobile: use a compact row layout or horizontally scrollable table with the `Open` action always visible.

## Acceptance Criteria

- Manager and Staff role selections land on the revamped audit workspace launch page.
- The page shows active audits in a table, not a dropdown.
- The table includes audit name, scope period, audit timeframe, current stage, status, budget, and an explicit open action.
- Users can clearly open an existing audit from the row or the `Open` button.
- `Add new audit workspace` opens a popup/modal.
- The popup captures the same required and optional information as the current intake flow.
- Creating a new audit adds it to the table without requiring a full manual page refresh.
- The page is simpler and less container-heavy than the current design.
- Crowe colors are used consistently through the existing CSS variables.
- Mobile and desktop layouts have no overlapping text or clipped controls.

## Verification Plan

- Run `npm run typecheck`.
- Run `npm run build`.
- Manually verify:
  - `/demo-login` Manager routes to `/audit-intake`.
  - `/demo-login` Staff routes to `/audit-intake`.
  - `/audit-intake` loads active audits from `GET /api/audits`.
  - Table row click opens the correct dashboard URL with audit query parameters.
  - `Add new audit workspace` opens the modal.
  - Required validation still blocks create until audit details and required files are valid.
  - Successful creation closes the modal and updates the table.
  - Empty, loading, and error states are readable.
  - Responsive layouts work at mobile, tablet, and desktop widths.
