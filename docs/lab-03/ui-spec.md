# Lab 3 – UI Specification

| | |
| :--- | :--- |
| **Related doc** | `specification.md` §8 (UI Specification Summary) |
| **Related Issue** | #77 *Lab 3 Engineering Contract (Spec-DD)* → sub-issue #88 *Draft ui-spec.md / api-spec.md* |
| **Traceability** | Implements FR-01–FR-24, BR-03, BR-17–BR-21; verified by AC-01–AC-33 |

TokTickIT keeps the **Zen Green Theme** established in Lab 2 (`docs/lab-02/ui-spec.md`). All tokens, badges, read-only field treatment, validation-message behavior, accessibility rules, and responsive breakpoints carry forward unchanged; this document specifies the new Lab 3 screens and the role-aware shell on top of them.

---

## 1. Zen Green Color Tokens (carried forward)

| Token Name | Hex Value | Use-case |
| :--- | :--- | :--- |
| **Primary Green** | `#006B3C` | Header, primary buttons, strong emphasis. |
| **Secondary Green** | `#0B7A46` | Active tabs, focus accents, links, hover. |
| **Pale Green** | `#EAF6EF` | Selected/success/subtle emphasis. |
| **Page Background** | `#F5F7F6` | Overall page canvas. |
| **Surface / Card** | `#FFFFFF` | Cards/panels; subtle border + restrained shadow. |
| **Text** | `#1F2A24` | Body copy and labels. |
| **Editable Field** | `#FFFFFF` bg / `#D1D9D5` border | Inputs/selects. |
| **Read-only Field** | `#F1F0E9` (warm ivory) or `#EDF3EE` (soft gray-green) | Non-editable display values (Ticket No, priority copies, etc.). |
| **Error** | text/border `#B3261E`, bg `#FBEAEA` | Validation/error states; message directly below the field. |
| **Warning** | Amber `#B45309` on `#FEF3C7` | Genuine warnings only. |
| **Success** | `#0B7A46` on `#EAF6EF` | Success confirmation, never color alone. |
| **Internal Note (new)** | bg `#FFFBEB` (pale yellow) / border amber `#FBBF24` | Operationally distinct notes surface (BR-21). |

Breakpoints: Mobile `< 768px` · Tablet `768–991px` · Desktop `≥ 992px` (identical to Lab 2).

---

## 2. Global App Shell & Navigation (Role-Aware)

### 2.1 Header Navbar
*   Background Primary Green (`#006B3C`), white foreground.
*   Left: "TokTickIT" brand.
*   Center/left nav is **role-aware** (ticket creation is Requester-only — §7 authorization matrix, BR-05):
    *   **Requester**: "My Tickets", "Create Ticket".
    *   **IT Staff**: "Ticket Queue", "My Tickets".
    *   **Administrator**: "Ticket Queue", "My Tickets", "Users".
*   Right: authenticated user context — name, role pill (`REQUESTER`/`IT_STAFF`/`ADMIN`), and a **Logout** button. The Lab 2 "Change Requester" control and the Simulation-Mode banner are removed (FR-03).

### 2.2 Route guards
*   No session → every app route redirects to `/login`.
*   `mustChangePassword === true` → every route redirects to `/change-password` until the password is changed (BR-03, FR-02).
*   Role guard on top of auth: IT Staff/Admin-only routes render a 403/redirect for a Requester; Admin-only routes render a 403/redirect for IT Staff (visual only — server enforces, BR-05).

---

## 3. Screen: Login

Full-page centered card on Page Background, `GET /api/auth/me` already probed (if a valid session exists, skip straight to home).

*   **Fields**: Email (labeled, `type=email`, autofocus), Password (labeled, `type=password`, show/hide toggle).
*   **Primary button**: "Log in" — loading state ("Logging in…" disabled) while in flight; no double submit.
*   **Error behavior**: a single safe banner above the form — "Invalid email or password." — for any 401 (BR-02 leaks nothing). Field-level messages (below each field) for client validation only (empty/email-shape).
*   On success → role home (Requester → My Tickets; IT Staff/Admin → Ticket Queue). If the returned user has `mustChangePassword`, route to `/change-password` instead.

---

## 4. Screen: Mandatory Password Change

Reached automatically when `mustChangePassword === true`; cannot be skipped or routed around (FR-02, BR-03).

*   **Fields**: Current Password, New Password, Confirm New Password.
*   **Client validation**: new ≥ 8 chars; confirms match. **Server validation is authoritative** and echoed below the relevant field on `400`/`401`.
*   **Behavior**: on `200` the app clears the gate and routes to the role home screen (AC-07). Logout remains available in the header.
*   A subtle note explains: "You are using a temporary password and must set a new one before continuing."
*   Cancel is **not** offered (the flow is mandatory); the header Logout is the only exit.

---

## 5. Screen: IT Staff Ticket Queue (Zen Green Data Table)

Route `/queue` — IT Staff & Admin only (Requester → 403 screen). Fetches `GET /api/staff/tickets`.

*   **Filter bar**: search input + Status dropdown (8 options) + IT Priority dropdown + Category + Related System + Owner (incl. "Unassigned") + sort control (`Updated` / `Status` / `Priority`) + Clear Filters. Debounced search; every change refetches (page reset to 1).
*   **List**:
    *   Desktop (≥ 992px): responsive table — Ticket No, Title, Requester, Category/System, Requested Priority (read-only badge, BR-14), **IT Priority** (editable badge), Status badge, Owner, Updated — row click → staff Ticket Detail.
    *   Mobile/tablet (< 992px): stacked cards with the same fields prioritized (Title, Ticket No, Status/priority pills, Owner, Updated).
*   **States**: loading skeleton; empty (zero tickets total); no-results (filters/search match nothing, with Clear Filters); error panel with Retry.
*   **Pagination**: centered bar with page-size control (matches Lab 2 My Tickets pattern).
*   Each row exposes quick actions at ≥ tablet width: **Claim** (when unassigned), **IT Priority** inline pill editor, and **status quick-transition** only when a single valid matrix edge exists from the current state (full matrix in the detail screen).

---

## 6. Screen: Ticket Detail — IT Staff / Admin View

Route `/tickets/:id` with a staff flag. Read-only Requester fields + operational controls + communication engine.

*   **Requester-submitted block (read-only)**: Ticket No, Title, Description, Category, System, Requester, Created/Updated, and **Requested Priority** — rendered with the Read-only Field token and explicitly tagged "Requested (read-only)". No control here edits it (BR-14).
*   **Ownership block**: current Owner (or "Unassigned"). Controls:
    *   **Claim** (primary) when unassigned and current user is eligible.
    *   **Reassign** (secondary) → inline user picker (active IT_STAFF/ADMIN only) + Confirm.
*   **Priority block**: **IT Priority** editable pills/select (`LOW/MEDIUM/HIGH/URGENT`) with save; success/error feedback inline (BR-14).
*   **Status workflow block**: current Status badge; action buttons rendered **only for legal matrix edges** from the current state (per §6). Each button is labeled by its target, e.g. "Mark In Progress", "Resolve", "Close", "Reopen", "Cancel". Invalid transitions are never offered; if the backend still rejects (out-of-sync), the 400 matrix message displays safely (BR-15, AC-19).
*   **Attachments**: as Lab 2 (read-only list for staff — no soft-remove UI for staff).
*   **Communication columns**: two side-by-side panels (stacked on mobile) —
    *   **Public Comments** (white surface): list newest-first; composer textarea + "Post public comment" primary button.
    *   **Internal Notes** (Pale Yellow `#FFFBEB` surface, amber border, **lock icon** + "Internal — IT Staff only" label): distinct composer + "Post internal note" button (BR-21). This visual distinction prevents accidental public posting.
*   **Append-only cues**: no edit/delete affordances anywhere in either panel; the composer labels say "Append…" (BR-19).

---

## 7. Screen: Ticket Detail — Requester View

Same route, Requester role (own tickets only; foreign ticket → 403 screen).

*   Read-only blocks as Lab 2 (Ticket No, Title, Description, Category, System, Requested Priority badge, status badge, dates, attachments).
*   **Requester intent action**: when the current status is one of `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, a primary/neutral button "Problem Appears Resolved" posts resolve-intent (→ status `RESOLVED`); when `RESOLVED` or `CLOSED`, the same button reads "Problem Still Occurs / Reopen" (→ `REOPENED`) (AD-02). While loading, disabled. Invalid-state (`CANCELLED`) hides it (FR-15).
*   **Public Comments**: full read (newest-first) + composer — visible because the user is the owner (BR-17).
*   **Internal Notes**: **never rendered** — the section does not exist for a Requester, nothing to hide visibly (server still returns 403, BR-18; the UI additionally never fetches it).

---

## 8. Screen: Administrator User Management

Route `/users` — Admin only. Fetches `GET /api/admin/users`.

*   **User table**: single search box (name/email partial, debounced) — no pagination/sort/multi-filter (excluded scope, AD-10). Columns: Name, Email, Role pill, Status pill (`Active`/`Inactive`), Must-Change-Password indicator, actions.
*   **Create User**: modal or dedicated panel — Name, Email, **Role select** (exactly one of `REQUESTER`/`IT_STAFF`/`ADMIN`), initial Password, Active toggle (default on). Email duplicate on submit → 409 message shown against the Email field (BR-09). New users default to `mustChangePassword = true`.
*   **Edit User**: inline/modal — Name, Email, Role select, Active toggle:
    *   Deactivating the **current admin's own account** → guarded message and no change (BR-10).
    *   Deactivating/downgrading the **last active Administrator** → guarded message and no change (BR-11).
*   **Reset Password**: per-row action opening a small form for the admin-chosen temporary password; success shows "User must change password at next login" (BR-03, AD-09).
*   No **Delete** button anywhere (BR-12).

---

## 9. Status & Priority Badges (8 statuses)

Badges keep Lab 2 pill styling; text labels always present (never color alone).

*   **Priority** (both `requestedPriority` and `itPriority`): `URGENT` soft red, `HIGH` light orange, `MEDIUM` Pale Green, `LOW` light gray.
*   **Status**:
    *   `NEW` — light orange / dark orange.
    *   `OPEN` — light blue / deep blue.
    *   `IN_PROGRESS` — Secondary Green-tinted (`#EAF6EF`) / Primary Green.
    *   `WAITING_FOR_REQUESTER` — amber (`#FEF3C7` / `#B45309`) to signal the ball is in the Requester's court.
    *   `RESOLVED` — Pale Green / Primary Green.
    *   `CLOSED` — light gray / dark gray.
    *   `REOPENED` — soft red / `#B3261E` (attention).
    *   `CANCELLED` — neutral gray with strikethrough sound-alike styling (muted).

---

## 10. Reusable State & Feedback Rules

*   **Loading** (`useState`/skeleton patterns): all fetch-driven screens show a skeleton/spinner; buttons show busy/disabled while their request is in flight — duplicate submissions impossible (carried from Lab 2 BR-09).
*   **Empty vs no-results**: distinct, textually different states (statistics/queue and admin list apply Lab 2's BR-13 rule).
*   **Error**: soft-red alert with Retry; entered data preserved on validation failure (Lab 2 BR-10); never a raw stack trace (BR-06).
*   **Validation**: client + server identical, server authoritative; messages appear directly under fields, asterisks never replace messages (Lab 2 §4.2 rules, carried).
*   **Read-only fields**: the dedicated warm-ivory/gray-green token only (Ticket No, Requested Priority for staff, system-generated values, dates).
*   **Accessibility (carried)**: focus rings Secondary Green, visible labels, keyboard-operable, modals trap focus, `Esc` closes, `aria-disabled` on busy controls, badges never color-only.

*End of UI specification. Conforms to `specification.md` §7, §8; tokens/breakpoints inherit `docs/lab-02/ui-spec.md`.*