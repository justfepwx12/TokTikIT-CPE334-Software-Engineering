# Lab 2 – UI Specification

| | |
| :--- | :--- |
| **Related doc** | `specification.md` §6 (UI Specification Summary) |
| **Related Issue** | #29 *Lab 2 Engineering Contract (Spec-DD)* → sub-issue #39 *Draft ui-spec.md* |
| **Traceability** | Implements FR-01–FR-07, FR-10–FR-17; BR-01, BR-03, BR-04, BR-09, BR-13; verified by AC-01–AC-05, AC-06, AC-15, AC-16, AC-25, AC-26 |

The user interface of **TokTickIT** is anchored on the **Zen Green Theme**—a clean, calming design system emphasizing organic greens, sage neutrals, and dark forest highlights to promote focus and modern design principles. Token values below follow the labsheet's fixed palette (labsheet §7) exactly.

---

## 1. Zen Green Color Tokens

Our interface relies on a consistent palette of semantic and physical color values:

| Token Name | Hex Value | Tailored Use-case / Semantic Meaning |
| :--- | :--- | :--- |
| **`Primary Green`** | `#006B3C` | App header, primary action buttons, strong emphasis. |
| **`Secondary Green`** | `#0B7A46` | Active tabs, focus accents, links, hover states. |
| **`Pale Green`** | `#EAF6EF` | Selected, success, and subtle section-emphasis backgrounds. |
| **`Page Background`** | `#F5F7F6` | Overall page canvas — quiet near-white. |
| **`Surface / Card`** | `#FFFFFF` | Cards and panels; subtle border + restrained shadow, no flat token color. |
| **`Text`** | `#1F2A24` (dark charcoal-green) | Body copy and labels — comfortable reading, never pure black. |
| **`Editable Field`** | `#FFFFFF` bg / `#D1D9D5` border | Default input/select background with a clear neutral border. |
| **`Read-only Field`** | `#F1F0E9` (warm ivory) or `#EDF3EE` (soft gray-green) | Read-only/disabled display fields — visually distinct from editable fields, still readable. See §4.2a. |
| **`Error`** | text/border `#B3261E`, background `#FBEAEA` | Error states, validation messages; message appears immediately below the field. |
| **`Warning`** | Amber `#B45309` on `#FEF3C7` | Amber callout/badge only for genuine warnings — never ordinary decoration. |
| **`Success`** | `#0B7A46` on `#EAF6EF` | Success confirmation; always paired with readable text, never color alone. |

---

## 2. Layout & Responsive Breakpoints

The UI seamlessly scales across viewport shapes using the labsheet's exact breakpoints (labsheet §8.7):
*   **Mobile (`< 768px`)**: Single-column vertical layout. Navigation menu collapses into a clean hamburger panel or wraps onto a tab-bar. Ticket listings display as individual detailed **Cards** instead of tables. Buttons remain touch-friendly; no horizontal page scrolling.
*   **Tablet (`768px` to `991px`)**: Two-column layout where practical. Summary and Description receive enough width. Side-by-side forms wrap to stack vertically if labels feel compressed.
*   **Desktop (`>= 992px`)**: Multi-column grids as specified; content centered with a sensible maximum width. Tickets are listed in a comprehensive, dense responsive Table.
*   **All sizes**: no clipped labels, overlapping messages, hidden buttons, or unreadable attachment names.

---

## 3. Global App Shell & Navigation Header

### 3.1 Header Navbar
*   **Background**: Primary Green (`#006B3C`) with white foreground text (`#FFFFFF`).
*   **Left-Section**: Bold brand identifier "TokTickIT" followed by horizontal navigation links: "My Tickets" and "Create Ticket".
*   **Right-Section**: Simulated user context area — this is a **display of the already-selected Requester only**, not the selection mechanism itself (selection happens on the dedicated full-screen route, §3.2):
    *   Read-only label showing the selected simulated Requester's name (e.g., "Jane Doe").
    *   "Change Requester" button (secondary/border style) that navigates back to the Development Requester Selection Screen.
*   **Simulated Login Alert Banner**: If no requester is selected on initial visit, a prominent orange-yellow or light-mint banner sits directly below the header with the message:
    > "**Simulation Mode**: Please select an active Development Requester to simulate the user context."
*   Attempting to navigate directly to "My Tickets", "Create Ticket", or any Ticket Detail URL without a selected Requester redirects to the Selection Screen (§3.2).

### 3.2 Development Requester Selection Screen (dedicated full-page route)

This is a **separate, full-page screen** (route `/select-requester`), shown before any ticket screen is reachable — not merely a header dropdown. It mirrors labsheet §8.1.

*   **Layout**: Centered card (max width ~480px) on the Page Background (`#F5F7F6`), vertically centered on the viewport.
*   **Required elements** (all must be present):
    1.  "TokTickIT" title/brand mark.
    2.  Short explanatory text: "Select a Development Requester to test requester-specific ticket behavior. This is not a login screen. Authentication and role-based access will be introduced in Lab 3."
    3.  "Development Requester" labeled `<select>` dropdown, required, populated from `GET /api/requesters` (active Requesters only).
    4.  Helper note directly under the dropdown: "Only active development requesters are shown."
    5.  An informational callout: "Authentication coming in Lab 3 — In Lab 3, this selection will be replaced with secure authentication so you can access the system with your own account."
    6.  Primary "Continue →" button (disabled until a Requester is chosen) and a secondary "Cancel" button.
*   **States**:
    *   **Loading**: skeleton/spinner in place of the dropdown while `GET /api/requesters` is in flight.
    *   **Empty** (no active Requesters returned): dropdown replaced with a message ("No active Development Requesters are available. Contact an administrator.") and Continue disabled.
    *   **API failure**: Alert Soft Red panel with a retry action; form values (none, since nothing is entered yet) are not lost.
*   **Accessibility**: dropdown has an associated `<label>`, Continue/Cancel are reachable via `Tab` in order, and the callout/banner text is never the only indicator (icons are decorative, not load-bearing).
*   **After Continue**: the app shell (§3.1) shows the selected Requester's name; the user is routed to My Tickets (or their originally intended destination); `Change Requester` returns here.

---

## 4. Reusable UI Components & States

All custom components must adhere to the Zen Green standards.

### 4.1 Buttons (`Button`)
*   **Primary Button**:
    *   *Default*: Background Primary Green (`#006B3C`), text white.
    *   *Hover*: Background Secondary Green (`#0B7A46`).
    *   *Focus*: Highlight ring with Secondary Green (`#0B7A46`).
    *   *Disabled/Loading*: Background grayed-out (`#9CA3AF`), cursor `not-allowed`, `aria-disabled="true"`, removed from tab order. Displays a spinning loading wheel alongside text like "Submitting...".
*   **Secondary/Border Button**:
    *   *Default*: Border Primary Green (`#006B3C`), text Primary Green, transparent background.
    *   *Hover*: Background Pale Green (`#EAF6EF`).

### 4.2 Text Inputs & Select Fields (Editable)
*   *Default State*: White background, Editable-Field border (`#D1D9D5`), text dark charcoal-green.
*   *Focus State*: Border changes to Secondary Green (`#0B7A46`) with an outer outline ring in the same color.
*   *Error State*: Border/text turn Error red (`#B3261E`) with a soft red background fill (`#FBEAEA`).
*   **Validation Error Messages**: Placed directly below the respective input field in Error-red text (`#B3261E`), sized small (`0.875rem`). This message — never the required-field asterisk alone — is the source of truth for what is wrong.

### 4.2a Read-only Fields (distinct from Editable)
*   Read-only fields (Ticket Number, Ticket Date, Requester, and any other system-generated/non-editable value) use the dedicated **Read-only Field** token: warm-ivory (`#F1F0E9`) or soft gray-green (`#EDF3EE`) background, a slightly muted border, and non-interactive cursor.
*   This shading must never be reused for editable inputs, disabled-but-editable inputs, or error states — it signals specifically "this value is not user-editable," and is applied consistently across Create Ticket (Ticket Number/Date/Requester) and Ticket Detail (all fields).
*   Read-only fields still carry a text `<label>` and remain reachable by screen readers, but are excluded from the Tab order since there is no action to take.

### 4.3 Status & Priority Badge Components
Badges use small, rounded pill shapes with semi-transparent background fills and high-contrast text.

#### Priority Badges:
*   `URGENT`: Background soft red (`#FBEAEA`), text bright red (`#B3261E`), bold.
*   `HIGH`: Background light orange (`#FFF7ED`), text dark orange (`#C2410C`), bold.
*   `MEDIUM`: Background Pale Green (`#EAF6EF`), text Primary Green (`#006B3C`), bold.
*   `LOW`: Background light gray (`#F3F4F6`), text dark gray (`#4B5563`).

#### Status Badges:
*   `PENDING`: Background light orange, text orange.
*   `IN_PROGRESS`: Background light blue, text deep blue.
*   `RESOLVED`: Background Pale Green (`#EAF6EF`), text Primary Green (`#006B3C`).
*   `CLOSED`: Background light gray, text dark gray.

---

## 5. Screen Layouts

### 5.1 "Create Ticket" Screen
*   Organized into a clean card layout with a maximum reading width of `768px`.
*   Includes inputs for Title, Category, Related System, Priority, and Description.
*   Includes a file attachment field supporting multiple file drops. Displays list of selected draft files with individual remove crosses.
*   "Submit Ticket" button at bottom right with standard loading/disabled transition triggers.
*   **Success state (post-submission, FR-07/AC-01)**: On a successful `201` response, the form fields are replaced within the same card by a confirmation panel: a Pale Green (`#EAF6EF`) success banner with a checkmark icon and readable text (never color alone), the backend-generated Ticket Number shown prominently using the Read-only Field token (§4.2a), and two actions — a primary "View Ticket" button (navigates to Ticket Detail for the new ticket) and a secondary "Create Another" button (resets the form to a blank Create Ticket state). Draft attachment state and any prior validation messages are cleared once this panel is shown.

### 5.2 "My Tickets" Screen
*   **Search and Filter Section**: A horizontal bar containing a search input field, filters (Category, Related System, Status, Priority dropdowns), and Sort-by triggers.
*   **List Section**:
    *   *Desktop View*: Structured table with light-gray headers, dividing borders, and alternating row background fills for clean visual scanning.
    *   *Mobile View*: Vertical stack of individual cards. Each card contains the Ticket No, Title, Priority/Status pills, and Date Created in a clear hierarchy.
*   **Pagination Bar**: Centered below the listing. Left/Right arrow icons, active page highlights with Primary Green background, and records-per-page selectors.

### 5.3 "Ticket Detail" Screen
*   Displays ticket attributes in a read-only form layout utilizing distinct labels and values.
*   Attachments are arranged in a dedicated grid block below the description.
*   **Attachment List**:
    *   Displays filename, mime type icon (e.g., pdf or image icon), file size, and standard download button.
    *   A soft-remove button (a red outline cross) is rendered only if the attachment belongs to the active simulated user's ticket.
    *   Clicking soft-remove displays a modal dialog with a text textarea input labeled "Reason for removal" and an action confirmation button.

---

## 6. Accessibility & Keyboard Rules

* Every interactive control (buttons, inputs, selects, the soft-remove icon) is reachable via `Tab` in a logical order and shows a visible focus ring (Secondary Green `#0B7A46` outline).
* All inputs and selects have an associated `<label>` (or `aria-label` for icon-only controls); icon-only buttons additionally expose a tooltip and accessible name.
* Required-field asterisks are a visual aid only — the validation message below the field is the source of truth and must never be omitted in favor of the asterisk alone.
* Status/priority information is never conveyed by color alone: badges always carry a text label (e.g., "URGENT", "PENDING") alongside the color fill.
* Modals (soft-remove confirmation) trap focus while open and restore focus to the triggering control on close; `Esc` closes the modal.
* Disabled/busy buttons set `aria-disabled="true"` and are excluded from the tab order while inactive.
