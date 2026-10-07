# Lab 4 – UI Specification

| | |
| :--- | :--- |
| **Related doc** | `specification.md` §8 (UI Specification Summary) |
| **Related Issue** | #124 *Lab 4 Engineering Contract (Spec-DD)* → sub-issue #130 *Draft ui-spec.md / api-spec.md* |
| **Traceability** | Implements FR-29–FR-33; BR-25, BR-29, BR-30; verified by AC-42, AC-45, AC-46, AC-48–AC-55 |

TokTickIT keeps the **Zen Green Theme** and all Lab 3 screen behavior (`docs/lab-03/ui-spec.md`). Tokens, badges, read-only treatment, validation-message behavior, accessibility rules, and breakpoints carry forward unchanged; this document specifies the two new Dashboards, the role home routing, and the Actions Taken section embedded in Ticket Detail.

Tokens (unchanged): Primary `#006B3C` · Secondary `#0B7A46` · Pale `#EAF6EF` · Page `#F5F7F6` · Surface `#FFFFFF` · Text `#1F2A24` · Read-only `#F1F0E9`/`#EDF3EE` · Error `#B3261E`/`#FBEAEA` · Warning amber · Success green. Breakpoints: Mobile `< 768px` · Tablet `768–991px` · Desktop `≥ 992px`.

---

## 1. Role Home & Navigation Changes

* Post-login home is role-based (AD-17): Requester → `/dashboard/requester`; IT Staff / Administrator → `/dashboard/staff`.
* Nav additions (all other items unchanged from Lab 3 §2.1):
  * **Requester**: "Dashboard", "My Tickets", "Create Ticket".
  * **IT Staff**: "Dashboard", "Ticket Queue", "My Tickets".
  * **Administrator**: "Dashboard", "Ticket Queue", "My Tickets", "Users".
* Route guards extend Lab 3 §2.2: `/dashboard/staff` renders a 403 screen for Requesters; `/dashboard/requester` for Staff/Admin shows their own requester-scoped view (tickets they requested) only if any exist, otherwise the empty state (dashboards never expose foreign data — BR-25).

---

## 2. Screen: Requester Dashboard (`/dashboard/requester`)

Summary cards over the caller's own tickets (FR-29), each card clickable into its filtered list (FR-31).

* **Cards**: My Open (`NEW/OPEN/IN_PROGRESS`), Waiting for Me (`WAITING_FOR_REQUESTER`, amber accent), Resolved, Closed, Reopened, Cancelled — big count + label + chevron affordance. A Follow-Up attention strip appears when `myFollowUpOpen > 0` ("IT flagged N of your ticket(s) for follow-up").
* **States**: Loading (skeleton cards) → Loaded → **Empty** ("You have no tickets yet." + primary button "Create your first ticket" → `/tickets/new`) → Error (safe banner + Retry, drafts unaffected).
* **Zero metrics** render `0`, never blanks or dashes (BR-29).
* **Layout**: Desktop 3-column card grid; Tablet 2-column; Mobile stacked single column. Cards are `<button>`-semantics links with visible focus rings.

---

## 3. Screen: IT Staff Dashboard (`/dashboard/staff`)

Operational landing for Staff/Admin (FR-30).

* **Cards**: Unassigned (needs triage, strongest emphasis), My Assigned, My In Progress, Waiting for Requester, Follow-Up Due (amber), Resolved Today (success tint). Each drills into the pre-filtered queue via its `drillDown` descriptor.
* **Shortcuts row**: "Record Action" (→ queue filtered to My Assigned, first ticket), "Open Queue" (→ `/staff/tickets`), "My Work" (→ queue `ownerId=me`). Shortcuts are plain links, never modals.
* **States**: Loading skeletons → Loaded → **Empty** ("Queue is clear. Nice work." + link "Browse all tickets") → Error (banner + Retry).
* **Layout**: Desktop 3-column grid + shortcuts toolbar; Tablet 2-column; Mobile stacked. Unassigned card stays first in DOM order at every viewport (tab order matches visual order).

---

## 4. Section: Actions Taken (embedded in Ticket Detail)

Rendered inside the existing `TicketDetail` (Requester) and `StaffTicketDetail` screens below comments/notes (FR-33).

### 4.1 List / Table

* **Columns**: Action Date-Time (local, with absolute `title` tooltip) · Description · Result · Performed By (name + role pill) · Follow-Up (badge "Follow-Up" amber when required, with note below) · Attachment Notes (muted, truncated with full text on focus/hover).
* **Order**: newest-first, paginated (20/page, "Load more" button — no infinite scroll traps).
* **Responsive**: Desktop full table; Tablet condensed table (Attachment Notes wraps); Mobile stacked cards (one action per card, same field order). The table scrolls **inside its card** when narrower than its content — the page itself never scrolls horizontally (BR-30).
* **Empty**: "No actions recorded yet." Staff see the Create form directly beneath; Requesters see helper copy only.

### 4.2 Create / Edit forms (Staff/Admin only)

* **Fields**: Action Date-Time (`datetime-local`, defaults now) · Description (textarea, counter `x/2000`) · Result (textarea, counter) · Follow-Up Required (checkbox) · Follow-Up Note (revealed + required when checked) · Attachment Notes (optional input).
* **Performed By**: read-only chip showing the logged-in user ("Recording as <name>") — no editable control exists (BR-23).
* **Behavior**: submit button disables while in flight with "Saving…" label (no double-submit, AC-52); field errors render inline below each field (mirroring API validation, AC-51); server `409` renders a banner "Someone updated this action — Refresh to load the latest, then retry." with a Refresh button (never silent overwrite); form input survives failed loads and errors as a local draft until successful save or explicit Discard.
* **Buttons by role**: Create/Edit controls render only for IT Staff/Admin; Requester views contain zero create/edit affordances (AC-50). Edit opens inline (same section, focused heading), never a modal (BR-30).

---

## 5. Shared State & Feedback Rules

* **Loading**: skeleton blocks matching the content shape (cards/table rows), never layout-shifting spinners mid-page.
* **Errors**: safe, generic banners (`Something went wrong. Retry.`) with a Retry action; raw API payloads and stack traces never render.
* **Validation**: client mirrors the API limits (1–2000 chars, follow-up-note conditional, `actionAt` skew); server remains authoritative.
* **Focus management**: after Create/Edit success, focus moves to the new/updated row's heading; after Refresh on 409, focus moves to the refreshed form; drill-down navigation moves focus to the list heading.
* **No color-alone signaling**: Follow-Up and status accents always pair color with text/icon.

---

## 6. Responsive & Accessibility Checklist (for AC-53–AC-55)

Per screen (both dashboards + both detail views), verified at 375 / 768 / 1280:

* [ ] No horizontal **page** scroll; no clipped text or controls.
* [ ] Tab order matches visual order; all interactive elements reachable and operable keyboard-only (AC-54).
* [ ] Focus indicator visible on every control (Secondary Green outline, never `outline: none` alone).
* [ ] Touch targets ≥ 40px on mobile; card grids collapse without overlap.
* [ ] Contrast meets the Lab 3 token pairs (text on Pale/Surface, white on Primary).
* [ ] Zero console errors; every link and drill-down resolves (AC-55).

*End of UI specification. Conforms to `specification.md` §5 (BR-29, BR-30) and §8.*
