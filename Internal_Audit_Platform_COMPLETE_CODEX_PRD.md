# Internal Audit Platform – Complete Codex-Ready PRD

## 1. Product Overview

### 1.1 Purpose
This product is a full-lifecycle internal audit management platform designed to replace spreadsheets, disconnected workflow tools, and manual email-based tracking with a single system of record. It centralizes the audit process from planning through reporting, while also tracking the administrative work that makes audits slow and difficult to manage in practice.

The application will be built first as a prototype with static data, but it must be designed as if it will later connect to real company systems. The long-term intent is for the platform to ingest enterprise data such as timekeeping, risk assessments, third-party inventories, application inventories, issue logs, and document repositories.

### 1.2 Fictional Prototype Company
The prototype data should represent a fictional mid-market company named **Midwest Financial Corp (MFC)**. MFC should feel realistic for an internal audit team and include typical data assets such as business units, third parties, applications, open issues, RCSA results, and monitoring outputs.

### 1.3 Goals
- Replace manual tracking in spreadsheets and email chains.
- Provide a live dashboard for audit execution and leadership visibility.
- Surface timeline risk, budget risk, and response bottlenecks early.
- Automate reminders and status tracking for audit tasks.
- Support AI-assisted planning outputs in the future, while remaining static for now.
- Provide a polished, modern, highly visual UI that feels enterprise-grade.

### 1.4 Primary Users
- Audit Project Manager / Auditor in Charge (AIC)
- Audit Staff / Testers
- Senior Audit Manager
- Director
- Chief Audit Executive (CAE)

### 1.5 Core Audit Lifecycle Covered
- Planning
- Fieldwork
- Reporting
- Administrative tracking
- Document creation and review
- Question/request management

---

## 2. Required Tech Stack

### 2.1 Frontend
- Next.js (App Router)
- TypeScript
- Tailwind CSS with CSS variables for theming
- shadcn/ui as the base component system, but restyled heavily
- Framer Motion for orchestration, page transitions, and subtle interactions
- Recharts for charts and dashboard visuals

### 2.2 Backend / Future-Ready Architecture
- Next.js API routes for future prototype APIs
- Prisma ORM
- PostgreSQL for future data persistence

### 2.3 State Management
- React Context for basic global state
- Zustand only if the app grows more complex

### 2.4 Validation
- Zod for runtime schema validation

### 2.5 Deployment
- Vercel

### 2.6 Design System Guidance
The UI should follow the Crowe design system direction:
- Indigo and amber should be the dominant brand colors.
- The interface should feel warm, premium, and modern, not cold or clinical.
- Use soft shadows, rounded corners, and layered surfaces.
- Avoid harsh borders and sterile grayscale layouts.
- Use visual emphasis for at-risk items through glow, motion, and color.

---

## 3. Information Architecture and Dashboard Tabs

The product should be organized into the following tabs:

1. Executive Dashboard
2. Control Testing
3. Hours & Budget
4. Question Log
5. Request Log
6. Planning
7. Fieldwork
8. Reporting
9. Documents / Audit Evidence
10. Admin / Configuration

Each tab should be accessible from a persistent top navigation or side navigation, with the Executive Dashboard as the landing page.

---

## 4. Core System Behaviors

### 4.1 Reminder Engine
The Reminder Engine is a cross-cutting behavior that drives accountability in the audit workflow. It should surface a “Send Reminder” action inline wherever a deadline or SLA is approaching so the user can act immediately without switching tools.

#### Required Logic
- In the Control Testing tab, show a “Send Reminder” button if a control due date is within 48 hours.
- In the Question Log tab, show a “Send Reminder” button if a question has been open for more than 48 hours without a response.
- The button should eventually trigger an email reminder, but for now it should be static and non-functional.

#### UX Requirements
- The button should be visually noticeable but not distracting.
- It should pulse gently or use a subtle glow when it appears.
- A tooltip should explain why it is visible, such as “Deadline approaching” or “Awaiting response > 48h.”
- The action should appear inline in the relevant row so users can act in context.

### 4.2 At-Risk Detection
At-risk items should be promoted visually across the dashboard. A row, card, or summary item should be treated as at risk when:
- A due date is approaching within 48 hours.
- A due date has already passed.
- A question has remained unanswered for more than 48 hours.
- Hours are trending over budget.
- A review queue is backing up at any stage.
- A key document has not been created on time.

At-risk items should use color, animation, and callout treatment so they are visible immediately.

### 4.3 Static AI Behavior for Planning
The Planning tab should include a static AI insights panel for now. This panel will later be connected to OpenAI, but in the prototype it should return mocked recommendations that feel realistic and audit-relevant.

The static AI output should:
- Recommend scope areas.
- Summarize risks and control gaps.
- Suggest what to include in planning narratives.
- Draft concise tollgate language.
- Reference the underlying source data shown on the page.

### 4.4 Test Document Assurance
The platform must ensure that all required audit documents are created, tracked, and linked to the audit lifecycle. This includes workpapers, evidence, planning narratives, tollgate decks, and the final audit report.

The document system should make it impossible to “forget” documents conceptually by showing missing, in-progress, and complete items clearly.

---

## 5. Data Model and Prototype Schemas

### 5.1 User

```ts
type Role = "AIC" | "STAFF" | "MANAGER" | "DIRECTOR" | "CAE";

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  team?: string;
}
```

#### Example Rows
| id | name | email | role | team |
|---|---|---|---|---|
| U1 | Jordan Lee | jordan.lee@mfcorp.com | AIC | Internal Audit |
| U2 | Priya Shah | priya.shah@mfcorp.com | STAFF | Internal Audit |

#### Purpose
Used throughout the app for ownership, assignments, review flows, and filtered views by role or team.

#### Where It Appears
- Control assignments
- Question assignment
- Review workflow
- Admin / configuration

---

### 5.2 Control

```ts
type ControlStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "AIC_REVIEW"
  | "MANAGER_REVIEW"
  | "DIRECTOR_REVIEW"
  | "COMPLETE";

interface Control {
  id: string;
  name: string;
  description: string;
  businessUnit: string;
  ownerId: string;
  status: ControlStatus;
  dueDate: string;
  plannedHours: number;
  actualHours: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  reviewStageOwner?: string;
  narrative?: string;
}
```

#### Example Rows
| id | name | businessUnit | ownerId | status | dueDate | plannedHours | actualHours | riskLevel |
|---|---|---|---|---|---|---|---|---|
| C-101 | User Access Review | Retail Banking | U2 | IN_PROGRESS | 2026-05-01 | 10 | 8 | HIGH |
| C-102 | Change Management Approval | Lending Ops | U1 | AIC_REVIEW | 2026-04-20 | 12 | 11 | MEDIUM |

#### Purpose
This is the core fieldwork dataset. It tracks what is being tested, by whom, when it is due, and whether the work has progressed through review.

#### Where It Appears
- Executive Dashboard
- Control Testing
- Hours & Budget (rollup)
- Reporting
- Audit documents

---

### 5.3 Question

```ts
interface Question {
  id: string;
  controlId: string;
  askedBy: string;
  assignedTo: string;
  dateSent: string;
  dueDate: string;
  status: "OPEN" | "RESPONDED" | "OVERDUE";
  questionText: string;
  responseText?: string;
  responseDate?: string;
}
```

#### Example Rows
| id | controlId | askedBy | assignedTo | dateSent | dueDate | status | questionText |
|---|---|---|---|---|---|---|---|
| Q-01 | C-101 | Priya Shah | Finance Lead | 2026-04-10 | 2026-04-12 | OPEN | Please provide evidence of quarterly access recertification. |
| Q-02 | C-102 | Jordan Lee | IT Ops Lead | 2026-04-05 | 2026-04-07 | OVERDUE | Please confirm change approvals for sample 3. |

#### Purpose
Tracks follow-up questions sent during fieldwork and provides accountability for open dependencies.

#### Where It Appears
- Question Log
- Control detail modal
- Executive Dashboard alerts
- Audit summary reports

---

### 5.4 Request

```ts
interface Request {
  id: string;
  controlId?: string;
  description: string;
  assignedTo: string;
  dateRequested: string;
  dueDate: string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED";
  responseNotes?: string;
}
```

#### Example Rows
| id | controlId | description | assignedTo | dateRequested | dueDate | status |
|---|---|---|---|---|---|---|
| R-01 | C-101 | Provide access review evidence | Finance Lead | 2026-04-10 | 2026-04-14 | OPEN |
| R-02 | C-102 | Provide approval matrix | IT Ops Lead | 2026-04-04 | 2026-04-08 | COMPLETED |

#### Purpose
Tracks document requests needed for testing and ensures the team knows what has been requested, from whom, and what remains outstanding.

#### Where It Appears
- Request Log
- Fieldwork tab
- Control detail modal
- Documents tab

---

### 5.5 AuditDocument

```ts
interface AuditDocument {
  id: string;
  type: "WORKPAPER" | "EVIDENCE" | "REPORT" | "TOLLGATE" | "PLANNING_NARRATIVE";
  title: string;
  linkedControlId?: string;
  linkedQuestionId?: string;
  linkedRequestId?: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";
  ownerId: string;
  dueDate?: string;
  templateName?: string;
}
```

#### Example Rows
| id | type | title | linkedControlId | status | ownerId | dueDate |
|---|---|---|---|---|---|---|
| D-01 | WORKPAPER | Access Review Workpaper | C-101 | IN_PROGRESS | U2 | 2026-04-18 |
| D-02 | TOLLGATE | Planning Tollgate Deck |  | NOT_STARTED | U1 | 2026-04-16 |

#### Purpose
Ensures every required audit artifact exists, is linked correctly, and has a lifecycle state.

#### Where It Appears
- Documents tab
- Control detail modal
- Planning tab
- Reporting tab

---

### 5.6 PlanningSourceSet

```ts
interface PlanningSourceSet {
  id: string;
  sourceType:
    | "THIRD_PARTY"
    | "APPLICATION"
    | "OUTSTANDING_ISSUE"
    | "RCSA"
    | "CONTINUOUS_MONITORING"
    | "PRIOR_FINDING"
    | "NEWS"
    | "REGULATORY_UPDATE";
  title: string;
  summary: string;
  sourceSystem: string;
  lastUpdated: string;
}
```

#### Example Rows
| id | sourceType | title | summary | sourceSystem | lastUpdated |
|---|---|---|---|---|---|
| P-01 | THIRD_PARTY | Cloud Payments Processor | Handles card settlement and tokenization. | TPRM Inventory | 2026-04-11 |
| P-02 | APPLICATION | Loan Origination Platform | Supports consumer lending workflow and approvals. | App Inventory | 2026-04-10 |

#### Purpose
Feeds planning logic by consolidating all audit-relevant input data into one place.

#### Where It Appears
- Planning tab
- AI scope suggestion panel
- Planning narrative panel

---

### 5.7 RCSA Record

```ts
interface RCSARecord {
  id: string;
  businessUnit: string;
  riskStatement: string;
  keyControls: string[];
  residualRiskRating: "LOW" | "MEDIUM" | "HIGH";
  lastReviewed: string;
}
```

#### Example Rows
| id | businessUnit | riskStatement | residualRiskRating | lastReviewed |
|---|---|---|---|---|
| RCSA-01 | Retail Banking | Unauthorized access could expose customer data. | HIGH | 2026-04-09 |
| RCSA-02 | Lending Ops | Incomplete approvals could lead to policy exceptions. | MEDIUM | 2026-04-08 |

#### Purpose
Represents business-owned risk and control self-assessment data used for scope development.

#### Where It Appears
- Planning tab
- AI scope panel
- Planning narrative generator

---

## 6. Core System Behaviors

### 6.1 Reminder Engine
The Reminder Engine is a cross-cutting behavioral layer that lets the platform detect time-sensitive items and surface an immediate action in the UI. It is critical for maintaining momentum across control testing and question management, especially when users are working across several controls at once.

Codex must implement a reusable function:

```ts
function shouldShowReminder(item): boolean;
```

#### Logic
- For a control, show the reminder button when `dueDate - currentDate <= 48 hours`.
- For a question, show the reminder button when `status === "OPEN"` and `now - dateSent > 48 hours`.

#### UI Behavior
- Button label: `Send Reminder`
- Tooltip: `Deadline approaching` or `Awaiting response > 48h`
- Animation: subtle pulse or glow
- Future behavior: email reminder trigger

---

### 6.2 At-Risk Highlighting
At-risk highlighting should make operational issues immediately visible without requiring the user to inspect every row. This behavior should be applied consistently across tables, cards, and summary widgets so the user always knows where attention is needed.

Visual treatment can include:
- Red or amber status colors
- Soft glow
- Pulsing border
- Prominent alert cards
- Inline warning text

---

### 6.3 Static AI Planning Behavior
The planning AI section should feel intelligent even before it is connected to real AI. It should return static but realistic scope recommendations, rationale, and narrative suggestions based on the planning input dataset.

This section should be designed so the future OpenAI integration can be dropped in with minimal UI change. For now, the content must be generated from mock data and presented as if it were an assistant recommendation.

---

### 6.4 Document Completion Assurance
The platform should not treat documentation as an afterthought. It must explicitly track which required documents exist, which are in progress, and which are still missing, because those artifacts are necessary for audit governance and delivery.

This behavior should be represented on the Documents tab and also surfaced in the relevant phase tabs so the user can see whether the audit is truly ready to move forward.

---

## 7. UI Component Definitions

### 7.1 KPI Card

```ts
interface KPIProps {
  title: string;
  value: string | number;
  status: "normal" | "warning" | "risk";
  subtitle?: string;
  delta?: string;
}
```

#### Behavior
- Staggers in on page load.
- Hover should slightly lift the card.
- Risk cards should animate with a subtle border glow.

#### Where Used
- Executive Dashboard
- Planning summary
- Reporting summary

---

### 7.2 DataTable

```ts
interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  searchable?: boolean;
  filterable?: boolean;
  rowActions?: boolean;
}
```

#### Behavior
- Sortable columns.
- Filter chips or dropdowns.
- Inline row actions.
- Smooth transitions when filtering or sorting changes the table content.

#### Where Used
- Control Testing
- Question Log
- Request Log
- Documents
- Planning data sets

---

### 7.3 StatusBadge

```ts
interface StatusBadgeProps {
  status: string;
  tone?: "neutral" | "warning" | "risk" | "success";
}
```

#### Behavior
- Used across the platform to keep statuses visually consistent.
- Should use brand-aligned colors and remain readable in both light and dark themes.

---

### 7.4 ReminderButton

```ts
interface ReminderButtonProps {
  visible: boolean;
  label?: string;
  onClick?: () => void;
}
```

#### Behavior
- Only appears when the reminder logic is satisfied.
- Should be visually compressed enough to fit in table rows.
- Should animate subtly but stay enterprise-appropriate.

---

### 7.5 Modal / Drawer Detail View

```ts
interface DetailPanelProps {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

#### Behavior
- Opens from a row click or action button.
- Displays full details, related items, and activity history.
- Should be used for control, question, request, and document drilldowns.

---

### 7.6 Timeline / Milestone Component

```ts
interface TimelineItem {
  id: string;
  label: string;
  date: string;
  status: "upcoming" | "active" | "complete" | "at_risk";
}
```

#### Behavior
- Visualize planning, fieldwork, reporting, and tollgate milestones.
- Highlight at-risk milestones with a more visible treatment.
- Animate progression as audit status changes.

---

## 8. Page-by-Page Requirements

---

### 8.1 Executive Dashboard

#### Description
The Executive Dashboard provides a real-time, high-level view of audit progress and risk exposure, enabling leadership to quickly identify issues requiring intervention. It aggregates key metrics and alerts into a single, easily scannable interface.

#### Required Page Components

##### 1. KPI Grid
A top-row set of KPI cards that summarize the audit at a glance. These cards should include completion rates, hours consumed, open questions, and overdue items. The grid should be responsive and should feel like the visual anchor of the page.

Data used:
- Control completion percentages
- Hours budget vs actual
- Question counts
- Open request counts
- Document completion counts

##### 2. Alerts Panel
This panel should display urgent operational issues, especially anything at risk of affecting the audit timeline. It should include overdue controls, overdue questions, approaching deadlines, and budget overruns.

Data used:
- Control due dates
- Question SLA age
- Hours variance
- Document gaps

##### 3. Timeline / Milestones
A horizontal timeline should show planning, fieldwork, and reporting milestones. Each milestone should be a milestone card or marker with status and date. Hovering should show details and upcoming thresholds.

Data used:
- Audit phase dates
- Tollgate dates
- Review deadlines

##### 4. At-Risk Items Table
A compact table should summarize any item that is already overdue or within the critical threshold. This allows the user to immediately see what needs attention and where to send reminders.

Data used:
- Control rows
- Question rows
- Request rows
- SLA thresholds

##### 5. Executive Summary Narrative
A small narrative block can describe the current audit posture in plain language. This is useful for leadership users who want a quick verbal summary before drilling into detail.

Data used:
- Aggregated dashboard data
- Risk status calculations

#### Design / Animation Notes
- KPI cards should animate in sequence.
- At-risk cards should pulse subtly.
- Alerts should slide or fade in on load.
- Timeline markers should animate when the phase status changes.

---

### 8.2 Control Testing Page

#### Description
This page serves as the operational core of the audit, where all control testing activities are tracked and managed. It enables visibility into ownership, progress, and review stages while highlighting items that may impact the audit timeline.

#### Required Page Components

##### 1. Controls Data Table
The table should list all controls and provide direct visibility into assignment, deadlines, hours, and status. Each row should represent a control test and should support sorting, filtering, and row-level actions.

Columns:
- Control ID
- Control Name
- Business Unit
- Assigned Tester
- Status
- Due Date
- Planned Hours
- Actual Hours
- Variance
- Risk Level
- Actions

Data used:
- Control schema
- User schema
- Hours data
- Reminder logic

##### 2. Filter Panel
Users should be able to filter by tester, status, business unit, due date range, and risk level. This makes the table usable even when the audit contains many controls.

Behavior:
- Filters should update the table instantly.
- Clearing filters should restore the full list.

##### 3. Status Workflow Bar
A workflow visualization should show the current stage of a control. This reinforces the review process and helps users understand where work is stalled.

Stages:
- Not Started
- In Progress
- AIC Review
- Manager Review
- Director Review
- Complete

##### 4. Control Detail Modal
Selecting a row should open a detail modal or drawer containing the full control narrative, linked items, timestamps, and progress notes.

Include:
- Control description
- Assigned tester
- Review history
- Linked questions
- Linked requests
- Linked documents
- Hours logged
- Notes or comments
- Activity history

##### 5. Reminder Button
If the control due date is within 48 hours, the row should display a “Send Reminder” action. This should be visually visible enough that the tester or manager can act quickly.

#### Design / Animation Notes
- Table rows should lift on hover.
- Status badges should be color coded.
- The reminder button should pulse softly.
- Overdue or at-risk rows should have an amber or red accent bar.

---

### 8.3 Hours & Budget Page

#### Description
The Hours & Budget page tracks actual time against budgeted hours so the audit team can understand whether the engagement is on pace. It is especially important in audit work because budget overruns often signal late testing, blocked requests, or review bottlenecks.

#### Required Page Components

##### 1. Summary KPI Cards
This section should show total budgeted hours, total actual hours, variance, and remaining hours. It should also show phase-level breakdowns for planning, fieldwork, and reporting.

##### 2. Phase Budget Table
A table should show each audit phase and the planned versus actual hours. Users should be able to see where the project is burning hours faster than expected.

Columns:
- Phase
- Budgeted Hours
- Actual Hours
- Variance
- Status

##### 3. Tester Hours Breakdown
A second table or chart should show hours by person. This is useful for understanding who is over capacity or where work has concentrated.

Columns:
- User
- Role
- Planned Hours
- Actual Hours
- Variance

##### 4. Chart Section
A bar or column chart should compare planned and actual hours by phase. A second chart may show hours by tester if helpful.

#### Data Used
- Control planned/actual hours
- User assignments
- Phase allocations

#### Design / Animation Notes
- Charts should animate when rendered.
- Over-budget values should use risk color treatment.
- A small status indicator should show whether the audit is under, on, or over budget.

---

### 8.4 Question Log Page

#### Description
The Question Log centralizes all audit-related inquiries and responses, ensuring that dependencies on business stakeholders are tracked and managed efficiently. It prevents delays by highlighting unanswered questions and enabling timely follow-ups.

#### Required Page Components

##### 1. Questions Data Table
The table should show each question, who asked it, who it was sent to, when it was sent, and whether the response is still pending. It should be easy to scan for overdue items.

Columns:
- Question ID
- Control ID
- Asked By
- Assigned To
- Date Sent
- Due Date
- Status
- Response Received?
- Actions

##### 2. SLA / Age Indicator
Each row should show how long the question has been open. If the open period crosses 48 hours, it should be flagged as overdue and visually emphasized.

##### 3. Question Detail Drawer
Clicking on a row should open a side panel or modal showing the full question, response, response notes, related evidence, and history.

Include:
- Full question text
- Response text
- Date sent
- Due date
- Response date
- Linked control
- Related documents

##### 4. Reminder Button
If a question is open for more than 48 hours, the row should show a “Send Reminder” button. This is a key administrative action and should be easy to access without leaving the table.

#### Design / Animation Notes
- Overdue questions should use a pulsing warning treatment.
- The reminder button should appear only when needed.
- The age indicator should update clearly and visually.

---

### 8.5 Request Log Page

#### Description
The Request Log tracks documents and evidence requested from business stakeholders. It is similar to the Question Log, but it focuses on document requests rather than open questions.

#### Required Page Components

##### 1. Request Table
The main request table should list all outstanding and completed requests. The table should be highly scannable because it is often used by audit teams during daily execution.

Columns:
- Request ID
- Related Control
- Description
- Requested From
- Date Requested
- Due Date
- Status
- Actions

##### 2. Request Detail Drawer
This should show the full request context, whether it has been fulfilled, and any notes about receipt or quality of evidence.

Include:
- Request description
- Linked control
- Requested by
- Requested from
- Response notes
- File attachments / placeholders

##### 3. Status and Overdue Treatment
Requests should be clearly flagged if they are overdue or in progress. These states should be visible in both the table and the detail view.

#### Design / Animation Notes
- Table row hover states should be consistent with the rest of the app.
- Status badges should be color coded.
- Overdue requests should stand out but not overwhelm the page.

---

### 8.6 Planning Page

#### Description
The Planning page consolidates all relevant audit inputs to support scoping decisions and preparation activities. It reduces manual data gathering and provides a foundation for AI-assisted scope recommendations.

#### Required Page Components

##### 1. Source Data Summary Cards
The page should contain cards for each source category that planning depends on. These cards should show a short summary, a record count, and the freshness of the data.

Source categories:
- Business unit third parties
- Key applications
- Outstanding issues
- RCSA
- Continuous monitoring results
- Prior audit findings
- News / regulatory developments

##### 2. Expanded Data Tables
Each source card should expand into a detailed table or panel. This gives the user a place to inspect the raw data before scope is finalized.

##### 3. AI Scope Suggestion Panel
This panel should return a static recommendation in the prototype. It should summarize what parts of the business unit appear risky, what controls might be in scope, and why that scope makes sense.

Include:
- Suggested in-scope areas
- Suggested risks
- Suggested controls to test
- Rationale
- Source citations / source labels inside the UI (not real citations, but visible provenance in the UI)

##### 4. Planning Narrative Generator
This component should produce a draft planning narrative using the selected scope and source data. The output should be editable because the user will often need to refine the narrative for a real engagement.

##### 5. Planning Tollgate Materials Generator
The page should also include a way to draft planning tollgate materials. This can be a filled-in template preview for now.

##### 6. Planning Readiness Checklist
This checklist should confirm whether the required planning artifacts are complete. It should ensure the team has the inputs needed to proceed to fieldwork.

Checklist items:
- Third parties reviewed
- Applications reviewed
- Issues reviewed
- RCSA reviewed
- Continuous monitoring reviewed
- Prior findings reviewed
- Planning narrative drafted
- Tollgate materials drafted
- Scope finalized

#### Data Used
- PlanningSourceSet
- RCSARecord
- Control metadata
- Issue metadata
- Monitoring summary records
- External news/regulatory inputs
- Prior audit issue summaries

#### Design / Animation Notes
- Each source card should expand smoothly.
- The AI recommendation panel should fade in like a generated output.
- Checklist items should use a clear completion state.
- At-risk planning inputs should be highlighted if stale or missing.

---

### 8.7 Fieldwork Page

#### Description
The Fieldwork page manages the execution of audit testing and ensures all controls progress through required review stages. It is the operational area where actual audit evidence is gathered, testing is documented, and review feedback is handled.

#### Required Page Components

##### 1. Workpaper Tracker Table
This should show all workpapers associated with the fieldwork phase. Each row should track the testing document’s progress and whether it has moved through the required review states.

Columns:
- Workpaper ID
- Related Control
- Title
- Owner
- Status
- Reviewer
- Last Updated
- Due Date
- Actions

##### 2. Workflow Actions
Users should be able to submit a workpaper for review, send it back, approve it, or mark it complete. These actions should reflect the actual audit workflow.

Buttons:
- Submit for Review
- Send Back
- Approve
- Mark Complete

##### 3. Linked Items Panel
The page should show the questions and requests related to the workpaper so the user can see whether all dependencies are resolved.

Include:
- Linked questions
- Linked requests
- Linked evidence
- Linked notes

##### 4. Progress Summary
A small summary area should show how many workpapers are complete, in review, or still open.

#### Design / Animation Notes
- Status changes should animate smoothly.
- Review actions should be prominent but clean.
- Workpaper cards or rows should use the same status language as controls.

---

### 8.8 Reporting Page

#### Description
The Reporting page supports audit report creation and multi-level approval workflows. It ensures consistency, completeness, and proper governance before the audit is formally issued.

#### Required Page Components

##### 1. Results Summary Panel
This panel should summarize the outcome of testing. It should show controls that passed, controls that failed, issues identified, and key themes across the audit.

##### 2. Report Generator
The report generator should produce a draft report template that mirrors the type of output an internal audit function would prepare. In the prototype, this should be static but feel realistic and editable.

##### 3. Review Workflow Tracker
The review workflow should show the report moving through approvals. The review path should be clearly visible and configurable.

Default sequence:
- AIC
- Manager
- Director
- CAE

##### 4. Review Action Panel
Reviewers should be able to approve or send back with comments. The AIC should be the one who resolves comments and updates the draft.

##### 5. Comments Thread
The report page should include a threaded comment area or review log so users can see what changes were requested and who requested them.

##### 6. Reporting Tollgate Materials
The page should include a reporting tollgate draft, which can later feed into a final report packet.

#### Data Used
- Control outcomes
- Issues
- Reviewers / user roles
- Document status
- Workflow comments

#### Design / Animation Notes
- The report review path should animate from one reviewer to the next.
- Approval states should be clearly color coded.
- Comments should slide in or fade in when added.

---

### 8.9 Documents / Audit Evidence Page

#### Description
This page is the master inventory for all required audit artifacts. It should make it obvious whether the audit team has created the evidence and deliverables required to finish the engagement successfully.

#### Required Page Components

##### 1. Document Table
The document table should list all required audit artifacts and their statuses. It should be filterable by type, status, owner, and linked control.

Columns:
- Document ID
- Type
- Title
- Linked Control
- Linked Question
- Linked Request
- Owner
- Status
- Due Date
- Actions

##### 2. Document Coverage Summary
This summary should show how many required document types are complete versus still missing. It should make gaps obvious before reporting begins.

##### 3. Missing Documents Alert
Any missing or not-started required documents should be surfaced in a highlighted list.

##### 4. Document Detail Drawer
The user should be able to open a document and inspect its metadata, linked items, and status history.

#### Required Document Types
- Workpapers
- Evidence files
- Planning narrative
- Planning tollgate deck
- Fieldwork tollgate deck
- Reporting tollgate deck
- Final audit report

#### Design / Animation Notes
- Missing documents should use warning styling.
- Complete documents should show a success state.
- The coverage summary should animate when counts change.

---

### 8.10 Admin / Configuration Page

#### Description
This page allows the audit team to configure review stages, document templates, alert thresholds, and future integration settings. It is the place where the system can be adapted to different clients or engagement styles.

#### Required Page Components
- Review stage configuration
- Reminder threshold settings
- Document template selector
- Future integration placeholder cards
- User/role configuration view

#### Key Behaviors
- Support default reviewer chain.
- Support optional extra reviewers.
- Support audit-client-specific templates.
- Support a future OpenAI key entry point without exposing it in the prototype UI.

---

## 9. Detailed Data Requirements by Page

### Executive Dashboard
Requires:
- Controls
- Questions
- Requests
- Hours rollup
- Document counts
- Milestones

### Control Testing
Requires:
- Controls
- Users
- Questions
- Requests
- Documents
- Hours logs

### Hours & Budget
Requires:
- Controls
- Hours by user
- Hours by phase
- Budget summary

### Question Log
Requires:
- Questions
- Controls
- Users
- Response history

### Request Log
Requires:
- Requests
- Controls
- Evidence placeholders

### Planning
Requires:
- PlanningSourceSet
- RCSARecord
- Controls
- Issues
- Prior findings
- Monitoring results
- Third-party inventory
- Application inventory
- Regulatory/news inputs

### Fieldwork
Requires:
- Controls
- Workpapers
- Questions
- Requests
- Documents

### Reporting
Requires:
- Control outcomes
- Issues
- Reviewer chain
- Documents
- Comments

### Documents
Requires:
- AuditDocument records
- Links to controls/questions/requests
- Completion status

---

## 10. Detailed Phase Plan (4 Weeks)

### Phase 1 – Foundation, Design System, and Static Data
**Goal:** Establish the project structure, visual foundation, and prototype data model.

#### Deliverables
- Next.js app scaffold
- Tailwind + theme setup
- Light and dark theme tokens
- Navigation shell
- Base dashboard layout
- Mock data generation for all schemas
- Reusable component foundation
- Executive Dashboard skeleton

#### Work to Complete
- Create project folders and feature domains.
- Build the application shell with navigation and header.
- Implement the main visual system, including spacing, surfaces, shadows, and status colors.
- Create all mock datasets for users, controls, questions, requests, documents, planning inputs, and RCSA records.
- Build the first version of the Executive Dashboard with KPI cards and alerts.

#### Acceptance Criteria
- App runs locally with the full shell.
- Mock data exists for all major entities.
- Dashboard is visually aligned with the design direction.
- Light and dark modes are supported.

---

### Phase 2 – Core Tracking and Operational Tables
**Goal:** Build the tracking systems that let the team manage control testing, questions, requests, and hours.

#### Deliverables
- Control Testing table and detail modal
- Hours & Budget page
- Question Log page
- Request Log page
- Reminder button logic
- Filters and sorting
- Table row actions

#### Work to Complete
- Implement the control table with row actions and drilldown.
- Add the reminder button logic for near-due controls.
- Build the question log with SLA tracking and reminder behavior.
- Build the request log and request detail view.
- Add hours rollup charts and variance reporting.
- Add filters by person, status, risk, and due date.

#### Acceptance Criteria
- All core tracking tables are functional.
- Reminder button logic appears correctly.
- User can filter and inspect rows.
- Tables render cleanly on desktop and tablet.

---

### Phase 3 – Planning, Fieldwork, and Document Governance
**Goal:** Build the workflow-heavy sections of the audit lifecycle and make planning outputs feel intelligent.

#### Deliverables
- Planning tab with all source inputs
- Static AI scope suggestion panel
- Planning narrative generator
- Planning tollgate generator
- Fieldwork workflow tracker
- Document tracking page
- Document completion assurance

#### Work to Complete
- Build planning source cards and expanded tables for third parties, applications, issues, RCSA, monitoring, prior findings, and external inputs.
- Create the static AI suggestion section.
- Build the planning narrative and planning deck draft areas.
- Implement fieldwork workpaper tracking.
- Build document inventory tracking with missing-document warnings.
- Add workflow states for review and completion.

#### Acceptance Criteria
- Planning page is fully navigable and grounded in realistic data.
- Documents are clearly tracked by type and status.
- Fieldwork workflow visually progresses through review stages.
- Missing documents are obvious and actionable.

---

### Phase 4 – Reporting, Review Workflow, Polish, and Demo Readiness
**Goal:** Finish the reporting stage, refine the UX, and prepare the application for demonstration or further enhancement.

#### Deliverables
- Reporting page
- Report draft generator
- Review workflow tracker
- Comments thread
- Reporting tollgate materials
- UI polish and animation pass
- QA and bug fixes
- Demo-ready final build

#### Work to Complete
- Build report summary and draft report sections.
- Implement reviewer chain and send-back behavior.
- Add comments thread and review history.
- Add reporting tollgate draft content.
- Polish animations, transitions, and status cues across the app.
- Fix layout issues, responsiveness issues, and data inconsistencies.
- Verify all core flows end-to-end.

#### Acceptance Criteria
- Reporting workflow is visible and understandable.
- The application feels polished and demo-ready.
- All major tabs are populated with realistic data.
- UI motion is smooth and professional.

---

## 11. UI and Motion Requirements

### Required Visual Style
- Modern dashboard feel
- High-end enterprise polish
- Warm, layered surfaces
- Strong hierarchy
- Clear status signaling
- Minimal visual noise

### Required Motion Behaviors
- Staggered load for cards and tables
- Hover lift on interactive elements
- Smooth tab transitions
- Soft pulsing for at-risk items
- Gentle glow on reminder actions
- Animated progress indicators for workflows

### Do Not
- Use generic plain cards with no motion
- Use boring gray-on-white visuals
- Make the interface feel overly playful
- Overanimate everything

---

## 12. File Structure

```text
src/
  app/
    dashboard/
      page.tsx
      layout.tsx
  components/
    ui/
    dashboard/
    tables/
    charts/
    modals/
  features/
    dashboard/
    controls/
    questions/
    requests/
    planning/
    fieldwork/
    reporting/
    documents/
    admin/
  lib/
    mock-data/
    schemas/
    utils/
  data/
    mfc/
  types/
  styles/
```

---

## 13. Success Metrics

- Reduction in spreadsheet/manual tracking
- Improved visibility into overdue items
- Faster question turnaround
- Fewer missed deadlines
- Better control of hours vs budget
- Cleaner reporting handoff
- More complete document tracking
- A polished demo usable for client conversations

---

## 14. Implementation Notes for Codex

- Use strong typing throughout.
- Keep components reusable and domain-specific.
- Build the UI in phases rather than all at once.
- Separate static data from presentation logic.
- Make future API and OpenAI integration points obvious in the code.
- Preserve all workflow states so the app can later evolve into a real operational tool.
