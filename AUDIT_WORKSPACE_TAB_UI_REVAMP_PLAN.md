# Audit Workspace Tab UI Revamp Plan

## Objective

Revamp the in-app AuditDESK workspace tabs after the landing, demo login, and audit workspace launch revamps in `AUDITDESK_UI_OVERHAUL_PLAN.md` and `AUDIT_WORKSPACE_LAUNCH_REVAMP_PLAN.md`.

The workspace should feel like a professional operating system for audit work: lighter, easier to scan, less container-heavy, and more demo-forward. Each tab should make its purpose obvious through layout, labels, actions, and concise help affordances rather than long explanatory copy.

## Current Context

- `/` is the AuditDESK landing page.
- `/demo-login` lets users choose Manager or Staff and routes to `/audit-intake?role=manager` or `/audit-intake?role=staff`.
- `/audit-intake` opens an existing audit or creates a new audit workspace.
- The app shell workspace tabs are:
  - Executive Dashboard
  - Hours & Budget
  - Question and Request Log
  - Planning
  - Fieldwork
  - Reporting
  - Admin
- The workspace currently uses many card-like surfaces, rounded containers, nested panels, dense status blocks, and stylized tables. The revamp should keep the same workflows but reduce visual weight.

## Shared UI Direction

Apply these rules across every phase:

- Use one compact page header per tab with the tab name, current phase/status, primary action, and one concise purpose line when needed.
- Prefer simple tables over card grids for operational data. Use `border-collapse`, sticky headers where helpful, light row dividers, row hover, and plain cells.
- Replace repeated metric cards with compact summary strips when the metrics are supporting context rather than primary content.
- Avoid cards inside cards. Use section bands, tables, toolbars, and right-side detail panels instead.
- Keep buttons action-oriented: `Open`, `Edit`, `Create`, `Upload`, `Generate`, `Approve`, `Send back`, `Export`.
- Add icon-only explanation buttons where a concept needs clarity. Use `CircleHelp` with `title`, `aria-label`, and a short tooltip/popover.
- Keep help copy brief. Aim for one sentence; two only when the logic is not obvious.
- Use badges sparingly for status, phase, role, and readiness. Do not make every data point a pill.
- Preserve Crowe visual tokens, but make the in-app workspace quieter than the landing/demo pages.
- Keep table actions keyboard reachable and make row click an enhancement, not the only affordance.

## Profile Persona Handoff

The selected demo persona must carry from role selection into the workspace.

Implementation requirements:

- Continue using `/demo-login` role links, but treat `role=manager` and `role=staff` as a workspace persona selection.
- Preserve the selected role through `/audit-intake` and into the dashboard launch URL.
- Add a stable workspace query value such as `persona=manager` or `persona=staff`, or a direct `activeUserId` query if that better matches existing user data.
- Map initial personas to existing demo users:
  - Manager: preferred Manager user, currently `U3`.
  - Staff: preferred Staff user, currently `U2`.
- Update `AppShell` so it seeds `activeUserId` from the selected persona/query on first workspace load.
- Store the selected persona in `localStorage` so refreshes preserve the choice.
- When the profile switcher changes the active user, update local state and persisted persona/user choice.
- Preserve persona context when navigating between workspace tabs alongside `auditId`, `auditLabel`, `companyName`, `scopePeriodLabel`, `mode`, `phase`, and `sync`.
- Keep this as demo behavior, not full role-based access control.

Files likely touched:

- `src/app/demo-login/page.tsx`
- `src/app/audit-intake/page.tsx`
- `src/components/layout/app-shell.tsx`
- Shared query helpers if introduced.

## Reusable Workspace Pieces

Introduce these during Phase 1 and reuse them as later phases need them:

- `WorkspacePageHeader`: compact header with title, phase/status, primary actions, and optional help button.
- `WorkspaceSummaryStrip`: small KPI strip with plain labels and values.
- `WorkspaceToolbar`: search, filters, sort, and primary actions in one predictable row.
- `WorkspaceDataTable`: simple table wrapper with sticky header, loading, empty, error, and row-action support.
- `WorkspaceHelpButton`: icon-only help affordance using lucide `CircleHelp`.
- `WorkspaceDetailPanel`: consistent right-side detail surface for inspect/edit flows.

These should replace one-off card-heavy patterns gradually rather than forcing a broad refactor up front.

## Phase 1: Executive Dashboard Tab

Goal: make the dashboard a high-signal command view that tells the demo user what is happening, what needs attention, and where to go next.

Primary changes:

- Replace the dark, heavy executive summary treatment with a quieter `Executive snapshot` section.
- Convert KPI cards into a compact summary strip with no nested explanatory text.
- Keep the at-risk content as the main table. Make it the clearest object on the page.
- Convert the milestone timeline into a simple milestone table:
  - Milestone
  - Phase
  - Owner
  - Due date
  - Status
  - Action
- Keep the hours chart, but reduce surrounding visual treatment and make it secondary to the risk/action table.
- Add a help button for:
  - Dashboard phase selector
  - At-risk calculation
  - Budget variance
  - Milestone status
- Add demo-forward actions:
  - `Refresh`
  - `Open top risk`
  - `View budget`
  - `Go to next milestone`

Files likely touched:

- `src/components/dashboard/executive-dashboard-view.tsx`
- `src/components/dashboard/executive-summary.tsx`
- `src/components/dashboard/kpi-card.tsx`
- `src/components/dashboard/at-risk-table.tsx`
- `src/components/dashboard/milestone-timeline.tsx`
- `src/components/charts/hours-bar-chart.tsx`

Acceptance criteria:

- The dashboard can be understood in under ten seconds.
- At-risk items and next actions are visually prioritized.
- Metrics are readable without large cards.
- Milestones are table-based, not a decorative timeline.
- Selected persona is visible in the shell when the dashboard opens from `/audit-intake`.

## Phase 2: Hours & Budget Tab

Goal: make budget setup, actuals, and variance easy to scan without making the page feel like a financial dashboard mockup.

Primary changes:

- Replace the top metric card grid with a compact budget summary strip:
  - Total audit budget
  - Planned hours
  - Actual hours
  - Remaining or over budget
  - Current phase variance
- Convert phase budget editing into a plain table with inline editing:
  - Phase
  - Start date
  - End date
  - Planned hours
  - Actual hours
  - Variance
  - Edit state
- Keep the bar chart, but place it beside or below the budget table based on viewport width.
- Simplify the recorded hours ledger into a standard table with upload controls in the toolbar.
- Simplify the control test budget section into a standard table. Avoid row-card spacing.
- Add help buttons for:
  - Total audit budget versus phase planned hours
  - Variance calculation
  - Uploaded actuals source
  - Control test budget visibility

Files likely touched:

- `src/app/hours-budget/page.tsx`
- `src/components/hours/audit-hours-planner.tsx`
- `src/components/hours/phase-budget-editor.tsx`
- `src/components/hours/lifecycle-milestone-editor.tsx`
- `src/components/hours/hours-upload-controls.tsx`
- `src/components/charts/hours-bar-chart.tsx`

Acceptance criteria:

- The tab reads as budget operations, not a collection of cards.
- Phase budget and actuals can be compared in one table.
- Upload actions are visible without long explanation text.
- Variance meaning is available through help buttons.

## Phase 3: Question and Request Log Tab

Goal: make the combined log feel like an operating queue for open questions, evidence requests, follow-ups, and delays.

Primary changes:

- Keep one unified queue table for questions and requests.
- Make the toolbar the control center:
  - Search
  - Status filter
  - Due filter
  - Assignee filter
  - Sort
  - `New question`
  - `New request`
- Default the demo view by persona:
  - Staff persona: show `Assigned to me` or action-needed items first when available.
  - Manager persona: show all open and overdue items first.
- Keep nested follow-ups, but reduce visual indentation and avoid heavily styled child rows.
- Move item details into the right-side detail panel with a small key-value table:
  - Type
  - Owner/contact
  - Control
  - Sent/requested
  - Due
  - Status
  - Delay impact
- Add help buttons for:
  - Current delay
  - Realized delay
  - Chain delay impact
  - Follow-up pending status
- Keep create modals compact with plain form fields and sticky action footer.

Files likely touched:

- `src/components/phase-two/combined-log-view.tsx`
- `src/components/phase-two/question-log-view.tsx` if still used independently
- `src/components/phase-two/request-log-view.tsx` if still used independently
- `src/components/ui/reminder-button.tsx`
- Shared detail/help/table components

Acceptance criteria:

- The queue table is the main experience.
- Users can immediately tell which items are overdue, assigned, and actionable.
- Delay logic is explainable through help buttons without adding paragraphs to the page.
- Persona selection changes the default lens without hiding the ability to view all items.

## Phase 4: Planning Tab

Goal: make planning feel like a structured workflow from input inventory to scope recommendation to review-ready planning artifacts.

Primary changes:

- Keep the existing planning subtabs:
  - Planning Inputs
  - Scope Planning
  - Planning Narrative
  - Planning Tollgate
- Replace metric cards with a compact planning readiness strip:
  - Source inputs
  - High-risk RCSAs
  - Current scope signals
  - Draft status
- Planning Inputs:
  - Make the source inventory a simple table.
  - Move source details into a right-side panel with a key-value table and a concise sample/details section.
- Scope Planning:
  - Reduce prompt-generator card weight.
  - Show source counts and RCSA counts in a small strip.
  - Keep `Copy prompt`, `Copy JSON`, and `Run AI scope review` as the visible actions.
  - Put prompt rules behind a help button instead of visible instructional copy.
- Planning Narrative and Planning Tollgate:
  - Use a compact artifact workspace with `Preview`, `Edit`, `Generate`, `Save`, `Export Word`, and `Export PPTX`.
  - Display review workflow as a table, not stacked review cards.
  - Keep comments in a simple review log table/list.
- Add help buttons for:
  - Planning readiness
  - Scope recommendation evidence rules
  - Artifact review stages
  - Locked draft states

Files likely touched:

- `src/components/phase-three/planning-view.tsx`
- `src/lib/planning-narrative/*`
- `src/lib/pptx-export.ts`
- Shared artifact/review components if extracted

Acceptance criteria:

- Each planning subtab has one obvious job.
- Planning inputs are scannable as an inventory table.
- Scope planning actions are clear without long visible prompt instructions.
- Narrative and tollgate review states are easy to understand from compact controls and tables.

## Phase 5: Fieldwork Tab

Goal: make fieldwork the execution center for controls, testing, evidence, document review, and fieldwork tollgate prep.

Primary changes:

- Keep the existing fieldwork subtabs:
  - Control Testing
  - Test Analytics
  - View Risks
  - Document Review
  - Tollgate Draft
- Control Testing:
  - Make the control testing queue a simple table:
    - Control
    - Owner
    - Due
    - Status
    - Linked blockers
    - Hours, if enabled
    - Action
  - Remove border-separated row-card styling.
  - Keep inline help for status and budget columns.
  - Default Staff persona to their controls when possible; default Manager persona to all controls.
- Test Analytics:
  - Reduce metric card density.
  - Use compact summary strips plus simple analysis tables.
  - Keep charts only where they answer a specific demo question.
- View Risks:
  - Keep a plain risk register table with linked controls and coverage status.
- Document Review:
  - Replace stage cards with a review-stage summary strip and a workpaper queue table.
  - Use the workpaper detail panel for editing/review actions.
- Tollgate Draft:
  - Match the artifact workspace pattern from Planning.
  - Put generation and export actions in one toolbar.
- Add help buttons for:
  - Control status logic
  - Linked blocker count
  - Review stage routing
  - Evidence versus workpaper distinction

Files likely touched:

- `src/components/phase-three/fieldwork-view.tsx`
- `src/components/phase-two/control-testing-view.tsx`
- `src/components/fieldwork/test-execution-analytics-panel.tsx`
- `src/components/fieldwork/review-notes-analytics-panel.tsx`
- `src/components/workpapers/workpaper-detail-panel.tsx`
- `src/components/testing-matrices/testing-matrix-detail-panel.tsx`

Acceptance criteria:

- The primary control/testing work is table-first.
- Staff and Manager demo personas land on useful default views.
- Workpaper review state is visible without scanning nested cards.
- Fieldwork artifact actions match Planning artifact actions.

## Phase 6: Reporting Tab

Goal: make reporting a clear handoff from fieldwork results to reporting tollgate and final report review.

Primary changes:

- Keep the existing reporting subtabs:
  - Fieldwork Results
  - Reporting Tollgate
  - Final Report
- Replace summary cards with a compact reporting readiness strip:
  - Reporting-ready results
  - Open blockers
  - Review comments
  - Tollgate status
  - Final report status
- Fieldwork Results:
  - Keep a simple results table with readiness, linked control, owner, blockers, and action.
  - Make `Reporting-ready only` and `All fieldwork results` a segmented control in the toolbar.
- Reporting Tollgate and Final Report:
  - Use the shared artifact workspace pattern:
    - Generate
    - Preview/Edit
    - Save
    - Export Word
    - Export PPTX
    - Approve
    - Send back
  - Display workflow as a table:
    - Stage
    - Reviewer role
    - Status
    - Last action
    - Comment
  - Display review comments as a simple log.
- Add help buttons for:
  - Reporting readiness
  - Review workflow roles
  - Finalized/locked artifact behavior
  - Open blocker count

Files likely touched:

- `src/components/phase-three/reporting-view.tsx`
- `src/lib/reporting.ts`
- `src/lib/reporting-data.ts`
- Shared artifact/review components if extracted

Acceptance criteria:

- Reporting starts with a clear readiness table.
- Artifact workflows use the same interaction model as Planning and Fieldwork.
- Manager persona can understand approval state quickly.
- Staff persona can see what must be resolved or resubmitted.

## Phase 7: Admin Tab

Goal: make admin feel like a clean setup and configuration area, not a separate mini-app.

Primary changes:

- Keep existing Admin subtabs:
  - Users
  - Settings
- Replace the intro card with the shared workspace header and a compact status strip.
- Users subtab:
  - Convert audit team management into a simple table:
    - Name
    - Role
    - Team
    - Email
    - Workspace access/status
    - Action
  - Convert business contacts into a simple table:
    - Contact
    - Team/function
    - Email
    - Related controls/items
    - Action
  - Keep add/edit flows in compact modals or detail panels.
  - Clearly mark the currently selected profile persona in the team table when applicable.
- Settings subtab:
  - Use plain setting rows with toggles, selects, and inline save actions.
  - Review stage labels should be a small editable table rather than stacked setting cards.
  - Control budget visibility should be a single toggle row with a help button.
- Add help buttons for:
  - Workspace user roles
  - Business contact purpose
  - Control budget visibility
  - Review stage label customization

Files likely touched:

- `src/components/admin/admin-view.tsx`
- `src/components/phase-three/audit-team-panel.tsx`
- `src/components/admin/business-contacts-panel.tsx`
- `src/components/admin/admin-settings-panel.tsx`
- `src/lib/audit-settings.ts`

Acceptance criteria:

- Admin is the least visually decorative tab.
- User, contact, and settings data are table or row based.
- The selected demo persona is visible and coherent with workspace profile state.
- Admin completes the tab sequence without introducing new visual patterns.

## Phase 8: Shell and Layout Overhaul

Goal: make the workspace feel open and editorial rather than a collection of nested containers. The header becomes a compact navigation bar, the sidebar toggle moves into the header, and tab content sits directly on the page background with no wrapping card.

Primary changes:

- App shell header:
  - Reduce header height significantly. Remove the tagline ("Audit | Documentation, Evidence, Stages, and Knowledge") and the subtitle ("A hub for internal audit management").
  - Keep: Crowe logo, current audit name and scope period (inline, compact), theme toggle, notifications button, profile button.
  - Add the sidebar collapse/expand toggle button to the right side of the header, alongside the existing icon buttons, so users can open and close the nav from the header without reaching into the sidebar.
  - Remove the "Supabase live data" and company name badges from the header. Company name is already visible in the audit context; the data source badge adds noise.
  - Move the phase selector dropdown out of the header entirely. Each tab page that needs phase context should surface it in its own `WorkspacePageHeader` as a compact control or badge.

- Main content area:
  - Remove the rounded panel, border, shadow, and background wrapper that currently surrounds the `<main>` element. Tab content should render directly against the page background.
  - Keep the outer page padding so content does not touch the viewport edge.
  - The sidebar and content area can share a subtle divider or rely on spacing alone.

- Sidebar:
  - The sidebar remains collapsible, but the toggle button moves to the header (described above). Remove the toggle button that currently lives inside the sidebar.
  - Keep existing active state styling and icon/label layout.

- Phase selector:
  - Remove the `DashboardPhaseSelector` from the `AppShell` header.
  - Add it to the `WorkspacePageHeader` on the Executive Dashboard tab so it appears inline with the tab's own controls. Other tabs that need phase context should handle it the same way.

Files likely touched:

- `src/components/layout/app-shell.tsx`
- `src/components/dashboard/executive-dashboard-view.tsx`
- `src/components/dashboard/dashboard-phase-selector.tsx` (if props need adjustment)

Acceptance criteria:

- The header is visibly shorter and uncluttered. Audit name and scope period are easy to read without competing taglines.
- Sidebar open/close is reachable from the header without scrolling or hunting inside the nav.
- Tab pages render without any surrounding card, border, shadow, or panel background.
- The phase selector appears on the dashboard tab page itself, not in the global header.
- No layout regressions on mobile: header items do not overlap, sidebar collapses correctly, content is readable.

## Implementation Sequence

1. Build shared workspace UI primitives in Phase 1 only as needed by Dashboard.
2. Complete and verify each tab before starting the next phase.
3. Reuse components from prior phases and only extract shared logic when two or more tabs need it.
4. Preserve existing data loading and mutation behavior unless a UI flow requires a small adapter.
5. Keep route/query behavior stable so workspace navigation retains audit and persona context.
6. After each phase, run focused manual checks for desktop and mobile before moving on.

## Acceptance Criteria For The Full Revamp

- Workspace tabs are visually consistent and less container-heavy.
- Every tab has a clear primary purpose and a small set of obvious actions.
- Tables are simple, professional, and readable.
- Explanation buttons clarify non-obvious logic without adding visible instructional copy.
- The selected Manager or Staff persona carries from `/demo-login` through `/audit-intake` into all workspace tabs.
- The profile switcher, notifications, and tab navigation preserve audit and persona context.
- No tab relies on large decorative cards to communicate core workflow state.
- Mobile and desktop layouts avoid overlapping text, clipped controls, and unstable table/action layouts.

## Verification Plan

- Run `npm run typecheck`.
- Run `npm run build`.
- Manually verify:
  - `/demo-login` Manager opens `/audit-intake?role=manager`.
  - `/demo-login` Staff opens `/audit-intake?role=staff`.
  - Opening an audit carries persona into `/dashboard`.
  - AppShell initializes the selected persona in the profile control.
  - Switching tabs preserves `auditId`, audit labels, phase, and persona context.
  - Each tab works at desktop, tablet, and mobile widths.
  - Tables remain readable with horizontal scroll where needed.
  - Help buttons are keyboard reachable and have accessible labels.
  - Existing create, edit, upload, generate, approve, and export workflows still function.

## Out Of Scope

- Full authentication or authorization by role.
- Major data model changes beyond small persona/query persistence support.
- Rewriting business logic for status, delay, budget, readiness, or review workflows.
- New marketing content inside the workspace.
