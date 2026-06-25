# AuditDesk Landing + Demo Login UI Overhaul Plan

## Summary

Create a two-page UI overhaul for AuditDesk: a new flashy Crowe-branded landing page at `/`, and a static demo login page at `/demo-login` that lets users choose Manager or Staff before routing to the existing AuditDESK intake/home experience.

The existing `src/app/page.tsx` audit intake page should be preserved by moving it to `/audit-intake`, so the current workspace launch flow is not lost.

## Key Changes

- Add a new landing page at `/` with a first-viewport `AuditDESK` hero, Crowe logo, short demo-oriented product explanation, and a primary `Launch Demo` button linking to `/demo-login`.
- Move the current root page implementation to `/audit-intake`; update `AppShell` route bypass logic so `/`, `/demo-login`, and `/audit-intake` render without product chrome.
- Add `/demo-login` with two polished role choices:
  - `Launch as Manager`
  - `Launch as Staff`
  - For v1 both route to `/audit-intake`; role persistence/auth behavior is deferred.
- Use Crowe colors already defined in `globals.css`: deep indigo, amber, teal, coral, warm surface tones, and existing Crowe logo assets.

## Animation + UI Implementation

- Use shadcn resources for reusable primitives: `Button`, `Card`, `Badge`, `Input`, `Label`, `Tabs` or segmented role selection, and `Tooltip` where helpful. Since this repo does not currently have `components.json`, the implementation should first add shadcn setup/components.
- Use Magic UI-inspired components/patterns from the docs:
  - `Aurora Text` for the `AuditDESK` hero treatment, reusing/extending existing `AuroraText`.
  - `Blur Fade` / `Text Reveal` style scroll reveals for sections.
  - `Bento Grid` for key functionality containers.
  - `Border Beam`, `Shine Border`, or `Magic Card` effects on feature cards.
  - `Animated Grid Pattern`, `Dot Pattern`, or subtle `Particles` background treatment for depth.
  - `Shimmer Button` treatment for `Launch Demo`.
- Implement scroll-triggered reveal behavior with existing `framer-motion` dependency using `whileInView`, `viewport={{ once: true }}`, staggered card entrance, and `prefers-reduced-motion` fallbacks.
- Landing content sections should explain demo-relevant functionality:
  - Executive dashboard and audit status visibility.
  - Planning inputs, scope rationale, and narrative/tollgate prep.
  - Question/request tracking and reminders.
  - Fieldwork workpapers, review status, and evidence dependencies.
  - Hours/budget monitoring and reporting handoff.
- Avoid a generic marketing page; first screen should immediately show what AuditDesk is and guide users into the demo.

## Development Goals

- Goal 1: Create the markdown plan file with routes, design system decisions, animation choices, and acceptance criteria.
- Goal 2: Refactor current `/` intake page into a preserved `/audit-intake` route with no behavioral regression.
- Goal 3: Build the new landing page with responsive hero, animated product story sections, and `Launch Demo`.
- Goal 4: Build the static demo login page with Manager/Staff choices and Crowe-branded styling.
- Goal 5: Verify desktop and mobile layouts, reduced-motion behavior, route navigation, and existing dashboard launch flow.

## Test Plan

- Run `npm run typecheck`.
- Run `npm run build`.
- Manually verify:
  - `/` shows the new animated landing page.
  - `Launch Demo` navigates to `/demo-login`.
  - Manager and Staff selections navigate to `/audit-intake`.
  - `/audit-intake` preserves the current audit creation and existing-audit launch behavior.
  - `/dashboard` and other app pages still render inside `AppShell`.
  - No text overlaps on mobile or desktop.
  - Animations disable or simplify under `prefers-reduced-motion`.

## Assumptions

- The Vercel reference pages were not accessible through the browsing tool, so the plan uses the user's written direction plus accessible Magic UI and shadcn docs.
- Role-based demo behavior is intentionally deferred; the login page is UI-only in this phase.
- Sources referenced: <https://magicui.design/docs/components> and <https://ui.shadcn.com/docs/components>.
