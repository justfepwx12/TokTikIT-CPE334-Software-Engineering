# TokTikIT-CPE334-Software-Engineering

TokTikIT is a web-based IT request and ticketing management system developed as part of the CPE334 Software Engineering course at KMUTT.

**Lab 3** delivers role-based ticketing — **Requesters** file and track tickets, **IT Staff** work an operational queue (claim, reassign, priorities, status workflow, comments/notes), and **Administrators** manage users — built on **React → Express REST API → Prisma ORM → PostgreSQL**. Authentication uses an HTTP-only server-side session cookie; identity always comes from the session, never from a client header (the Lab 2 `x-requester-id` simulation is removed).

---

## Features

* **Session login** — email + password with safe generic 401s; first login forces a password change (`mustChangePassword` gate); "Forgot password?" directs users to their IT administrator (resets are admin-mediated).
* **Role-aware shell** — Requesters see My Tickets + Create Ticket; IT Staff/Admin see the Ticket Queue (+ Users console for Admins); no nav chrome when signed out.
* **Create Ticket** — title, description, requested priority, category, and related system with client- and API-side validation (`zod`); attachments (≤ 5 MB, `jpeg/png/webp/pdf`, max 5 per ticket).
* **My Tickets** — paginated, searchable, filterable list; stable table on desktop, cards on mobile.
* **Ticket Queue (staff)** — search, status/IT-priority/category/system/owner filters, sorting, pagination.
* **Ticket operations** — claim, reassign (active IT/Admin only), IT priority (requested priority immutable), and an 8-state status workflow (legal edges only); requesters resolve/reopen via resolve-intent.
* **Communication** — append-only public comments (owner + staff) and internal notes (staff/admin only, visually distinct); no edit/delete.
* **Admin console** — list/search/single-role filter, create/edit, activate/deactivate, admin-chosen password resets with self/last-admin safety guards; nothing is ever deleted.

---

## Tech Stack

**Frontend (Client)**
* [React](https://react.dev/) - UI Library
* [TypeScript](https://www.typescriptlang.org/) - Programming Language
* [Vite](https://vite.dev/) - Build Tool & Development Server
* [React Router](https://reactrouter.com/) - Client-side routing
* [Bootstrap](https://getbootstrap.com/) - CSS Framework for UI components

**Backend (Server)**
* [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/) - Web Framework
* [TypeScript](https://www.typescriptlang.org/) - Programming Language
* [PostgreSQL](https://www.postgresql.org/) - Relational Database
* [Prisma](https://www.prisma.io/) - Next-generation ORM
* [Zod](https://zod.dev/) - Request validation
* [Multer](https://github.com/expressjs/multer) - Multipart file uploads
* [express-session](https://github.com/expressjs/session) + [connect-pg-simple](https://github.com/voxpelli/node-connect-pg-simple) - Server-side sessions in Postgres

**Testing & Tooling**
* [Vitest](https://vitest.dev/) & [Supertest](https://github.com/ladjs/supertest) - Unit and Integration Testing
* [Playwright](https://playwright.dev/) - End-to-end browser testing across desktop / tablet / mobile viewports
* [pnpm](https://pnpm.io/) - Fast, disk-space efficient package manager
* [Docker](https://www.docker.com/) - Containerization for local PostgreSQL database

---

## Repository Structure

```bash
TokTikIT-CPE334-Software-Engineering/
├── client/
│   ├── src/
│   │   ├── components/         # Badge, Button, Header, TextInput, TicketBadges, ...
│   │   ├── context/            # AuthContext (session user state)
│   │   ├── hooks/              # useAuth
│   │   ├── pages/              # Login, ForgotPassword, ChangePassword, MyTickets,
│   │   │                       #   CreateTicket, TicketDetail, StaffTicketDetail,
│   │   │                       #   TicketQueue, UserManagement
│   │   ├── utils/              # navigation (roleHome, safeRedirect), badgeColors
│   │   ├── api.ts              # Session-cookie API client (credentials: include)
│   │   ├── App.tsx             # Routes + auth/role guards
│   │   └── main.tsx
│   ├── tests/
│   │   ├── e2e/lab-03/         # Playwright specs (auth/staff/resolve/admin flows)
│   │   ├── lab-01/
│   │   ├── lab-02/
│   │   └── lab-03/             # Vitest UI tests per screen
│   ├── playwright.config.ts
│   ├── vite.config.ts
│   └── package.json
├── server/
│   ├── controllers/            # auth, admin, staffTickets, ticketOperations,
│   │                           #   comments, notes, resolveIntent, attachments, ...
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma       # User (Role), Ticket (dual priority, owner), Comment, InternalNote, ...
│   │   └── seed.ts             # Idempotent demo seed (AD-09 documented password)
│   ├── src/
│   │   ├── App.ts              # Express app + route wiring
│   │   ├── auth.middleware.ts  # requireAuth, requireRole, mustChangePassword gate
│   │   ├── session.ts          # express-session + Postgres store
│   │   ├── ticketId.ts         # Shared ticket-id parsing
│   │   ├── index.ts            # bootstrap / listen
│   │   └── prisma.ts           # Prisma client singleton
│   ├── tests/
│   │   └── lab-03/             # Supertest suites (auth, rbac, queue, ops, comms, admin, seed)
│   └── package.json
├── docs/
│   ├── lab-01/
│   ├── lab-02/
│   └── lab-03/                 # specification, api-spec, ui-spec, tests, reviewer, ai_use
├── artifacts/
│   └── lab-03/screenshots/     # Responsive E2E evidence (desktop/tablet/mobile)
├── docker-compose.yml          # PostgreSQL on host port 15432
├── pnpm-workspace.yaml
├── .gitignore
└── README.md
```

---

## Setup Guide

1. **Prerequisites**
   Ensure you have the following installed on your local machine:
   * Node.js (v24 or higher)
   * pnpm (v11 or higher)
   * Docker (for the local PostgreSQL container)

2. **Installation**
   Clone the repository and install dependencies for both server and client:
   ```sh
   git clone https://github.com/justfepwx12/TokTikIT-CPE334-Software-Engineering.git
   cd TokTikIT-CPE334-Software-Engineering
   pnpm install
   ```

3. **Environment Variables**
   ```sh
   # Server configuration (DATABASE_URL points at localhost:15432)
   cp server/.env.example server/.env

   # Client configuration (VITE_API_URL, defaults to http://localhost:3000)
   cp client/.env.example client/.env
   ```

4. **Database Initialization**
   ```sh
   # 1. Start PostgreSQL container (from project root)
   docker compose up -d

   # 2. Generate Prisma client and apply migrations
   pnpm --filter server exec prisma generate
   pnpm --filter server exec prisma migrate dev

   # 3. Seed demo data (idempotent — safe to re-run; restores documented passwords)
   pnpm --filter server exec prisma db seed
   ```

---

## Running the Application

Run the backend server and frontend client in separate terminal windows:

| App | Command | URL |
|---|---|---|
| Backend | `pnpm --filter server dev` | http://localhost:3000 |
| Frontend | `pnpm --filter client dev` | http://localhost:5173 |

> All protected endpoints use the HTTP-only session cookie (fetch with `credentials: include`). Log in with a seeded account — every seeded account uses the documented demo password `TokTickDemo123!` (e.g. `admin@toktikit.com` for Admin, `somchai.jaidee@toktikit.com` for IT Staff, `anong.srisuk@toktikit.com` for a Requester with tickets). Requesters change their password on first login.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Backend status → `{ "status": "ok", "service": "TokTikIT API" }` |
| POST | `/api/auth/login` | Session login (safe generic 401, sets cookie) |
| POST | `/api/auth/logout` | Invalidate session |
| GET | `/api/auth/me` | Current session user (restore on refresh) |
| POST | `/api/auth/change-password` | Change own password (clears `mustChangePassword`) |
| GET | `/api/categories` | Reference categories |
| GET | `/api/systems` | Reference related systems |
| GET | `/api/tickets` | Owned, paginated, filtered list (Requester) |
| GET | `/api/tickets/:id` | Owned ticket detail incl. attachments/comments |
| POST | `/api/tickets` | Create a ticket (identity from session) |
| GET | `/api/staff/tickets` | Operational queue with filters/sort/pagination (IT Staff, Admin) |
| GET | `/api/staff/tickets/:id` | Full operational detail (IT Staff, Admin) |
| POST | `/api/tickets/:id/claim` | Claim an unassigned ticket |
| POST | `/api/tickets/:id/assign` | Reassign to active IT Staff/Admin |
| PATCH | `/api/tickets/:id/it-priority` | Set IT priority (requested priority immutable) |
| PATCH | `/api/tickets/:id/status` | Status transition per §6 matrix |
| POST | `/api/tickets/:id/resolve-intent` | Requester resolve/reopen intent |
| GET/POST | `/api/tickets/:id/comments` | Public comments (owner + staff) |
| GET/POST | `/api/tickets/:id/notes` | Internal notes (IT Staff, Admin only) |
| GET | `/api/admin/users` | List/search/filter users (Admin) |
| POST | `/api/admin/users` | Create user with initial password (Admin) |
| PATCH | `/api/admin/users/:id` | Edit / activate / deactivate with safety guards (Admin) |
| POST | `/api/admin/users/:id/reset-password` | Admin-chosen temporary password (Admin) |
| POST | `/api/attachments/upload` | Upload a file (≤ 5 MB) linked to an owned ticket |
| GET | `/api/attachments/:id/download` | Stream binary file content |
| PATCH | `/api/attachments/:id/remove` | Soft-remove an attachment with mandatory reason |

Full contracts, validation rules, and error envelopes are documented in [`docs/lab-03/api-spec.md`](docs/lab-03/api-spec.md).

---

## Labs at a Glance

### Lab 1 — Foundation

| Area | Details |
|---|---|
| Identity | Health check + category seed |
| Core flow | Scaffold, DB, reference data |
| Tests | `health`, `categories` suites |
| Docs | `docs/lab-01/` |

### Lab 2 — Requester Loop

| Area | Details |
|---|---|
| Identity | Simulated requester (`x-requester-id` header) |
| Core flow | Create → My Tickets → Detail + attachments (≤5 MB, soft-remove) |
| Tests | `client/tests/lab-02/`, `client/tests/e2e/flow.spec.ts` |
| Docs | `docs/lab-02/` |

### Lab 3 — Role-Based Ticketing

| Area | Details |
|---|---|
| Identity | Session cookie; 3 roles (Requester / IT Staff / Admin) |
| Core flow | Queue, claim/assign, dual priorities, 8-state workflow, comments/notes, admin console |
| Tests | `server/tests/lab-03/` (81), `client/tests/lab-03/` (UI), `client/tests/e2e/lab-03/` (18 E2E runs) |
| Docs | `docs/lab-03/` (contract + reviewer + AI use) |

---

## Tests

Run everything (needs DB + seed from the Setup Guide):

```sh
# Server — full API suite (root suites + lab-03)
pnpm --filter server exec vitest run
pnpm --filter server exec vitest run tests/lab-03/   # Lab 3 only: 8 files / 81 tests

# Client — full UI suite (lab-01 + lab-02 + lab-03)
pnpm --filter client exec vitest run                 # 17 files / 116 tests

# E2E — full browser matrix (boots API + Vite itself)
pnpm --filter client exec playwright test                        # everything
pnpm --filter client exec playwright test tests/e2e/lab-03/     # Lab 3: 18 runs (6 journeys x desktop/tablet/mobile)
pnpm --filter client exec playwright test --project=mobile tests/e2e/lab-03/  # one viewport
```

Targeted runs while developing:

```sh
pnpm --filter server exec vitest run tests/admin-api.test.ts           # one server file
pnpm --filter client exec vitest run tests/lab-03/TicketQueue.test.tsx # one client file
```

---

## Checks (run before every PR)

```sh
pnpm --filter server exec tsc --noEmit          # server typecheck
pnpm --filter client exec tsc --noEmit          # client typecheck
pnpm --filter client exec eslint src tests      # client lint
pnpm --filter client build                      # production build (tsc -b + vite)
pnpm --filter server exec prisma validate       # schema check
pnpm --filter server exec prisma format --check # schema formatting
git diff --check                                # no whitespace errors
```

> `playwright test` boots both the Express API and Vite via `webServer` config, so no manual servers are needed. Requires a running PostgreSQL (`docker compose up -d`) with seed data. Per-spec accounts from the seed keep runs isolated; re-seed to restore passwords after E2E runs rotate them.
