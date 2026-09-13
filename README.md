# TokTikIT-CPE334-Software-Engineering

TokTikIT is a web-based IT request and ticketing management system developed as part of the CPE334 Software Engineering course at KMUTT.

**Lab 2** delivers a functional ticketing loop — **create ticket → my tickets → ticket detail** with file attachments — built on **React → Express REST API → Prisma ORM → PostgreSQL**. A simulated *Development Requester* identity (passed via the `x-requester-id` header) scopes all ticket and attachment operations to the logged-in user (BR-05).

---

## Features

* **Requester selection** — simulated login: pick an active Development Requester to act as.
* **Create Ticket** — title, description, priority, category, and related system with client- and API-side validation (`zod`). Priority and status tracking completed.
* **My Tickets** — paginated, searchable, filterable (category / system / status / priority) list owned by the active Requester.
* **Ticket Detail** — full ticket view including attachments; soft-removed attachments stay visible with their removal reason.
* **Attachments** — upload (≤ 5 MB, `jpeg/png/webp/pdf`, max 5 per ticket), metadata lookup, safe download streaming, and soft-remove with mandatory reason.

---

## Tech Stack

**Frontend (Client)**
* [React](https://react.dev/) - UI Library
* [TypeScript](https://www.typescriptlang.org/) - Programming Language
* [Vite](https://vitejs.dev/) - Build Tool & Development Server
* [React Router](https://reactrouter.com/) - Client-side routing
* [Bootstrap](https://getbootstrap.com/) - CSS Framework for UI components

**Backend (Server)**
* [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/) - Web Framework
* [TypeScript](https://www.typescriptlang.org/) - Programming Language
* [PostgreSQL](https://www.postgresql.org/) - Relational Database
* [Prisma](https://www.prisma.io/) - Next-generation ORM
* [Zod](https://zod.dev/) - Request validation
* [Multer](https://github.com/expressjs/multer) - Multipart file uploads

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
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/         # Badge, Button, Header, TextInput, ValidationMessage
│   │   ├── context/            # RequesterContext (active Requester state)
│   │   ├── hooks/              # useRequester, useRequireRequester
│   │   ├── pages/              # RequesterSelection, CreateTicket, MyTickets, TicketDetail
│   │   ├── api.ts              # API client (x-requester-id header)
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── tests/
│   │   ├── e2e/                # Playwright flow.spec.ts
│   │   ├── lab-01/
│   │   └── lab-02/             # Vitest unit tests per page/component
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── playwright.config.ts
│   ├── tsconfig*.json
│   └── vite.config.ts
├── server/
│   ├── controllers/            # attachment, listTickets, ticket, ticketById
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma       # Category, RelatedSystem, Requester, Ticket, Attachment
│   │   └── seed.ts
│   ├── services/               # ticketNumber.service.ts (TK-YYYYMMDD-XXXX)
│   ├── src/
│   │   ├── App.ts              # Express app + route wiring
│   │   ├── index.ts            # bootstrap / listen
│   │   └── prisma.ts           # Prisma client singleton
│   ├── tests/                  # Supertest integration tests (Vitest)
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── docs/
│   ├── lab-01/
│   └── lab-02/                 # specification, api-spec, ui-spec, tests, reviewer, ai_use
├── docker-compose.yml
├── pnpm-workspace.yaml
├── .gitignore
└── README.md
```

---

## Setup Guide

1. **Prerequisites**
   Ensure you have the following installed on your local machine:
   * Node.js (v24 or higher)
   * pnpm (v11.21.0 or higher)
   * Docker (for the local PostgreSQL container)

2. **Installation**
   Clone the repository and install dependencies for both server and client:
   ```sh
   git clone https://github.com/itspxsh/toktickit.git
   cd TokTikIT-CPE334-Software-Engineering
   pnpm install
   ```

3. **Environment Variables**
   ```sh
   # Server configuration
   cp server/.env.example server/.env

   # Client configuration
   cp client/.env.example client/.env
   ```

4. **Database Initialization**
   ```sh
   # 1. Start PostgreSQL container (from project root)
   docker compose up -d

   # 2. Generate Prisma client and apply migrations (in server directory)
   cd server
   pnpm exec prisma generate
   pnpm exec prisma migrate dev

   # 3. Seed reference data (categories, systems, requesters)
   pnpm exec prisma db seed
   ```

---

## Running the Application

Run the backend server and frontend client in separate terminal windows:

| App | Command | URL |
|---|---|---|
| Backend | `cd server && pnpm dev` | http://localhost:3000 |
| Frontend | `cd client && pnpm dev` | http://localhost:5173 |

> All Requester-scoped endpoints require the `x-requester-id` header carrying the active Requester's `id` (e.g. `x-requester-id: 1`). The client sends it automatically after selection on the login page.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Backend status → `{ "status": "ok", "service": "TokTikIT API" }` |
| GET | `/api/requesters` | Active Development Requesters (for simulated login) |
| GET | `/api/categories` | Seeded IT Categories reference data |
| GET | `/api/systems` | Seeded Related Systems reference data |
| GET | `/api/tickets` | Paginated/searchable/filterable list of tickets (`x-requester-id`) |
| GET | `/api/tickets/:id` | Full ticket detail incl. attachments (`x-requester-id`) |
| POST | `/api/tickets` | Create a new ticket (`x-requester-id`) |
| POST | `/api/attachments/upload` | Upload a file (≤ 5 MB) linked to an owned ticket |
| GET | `/api/attachments/:id` | Attachment metadata only (`x-requester-id`) |
| GET | `/api/attachments/:id/download` | Stream binary file content (`x-requester-id`) |
| PATCH | `/api/attachments/:id/remove` | Soft-remove an attachment with mandatory reason |

Full contracts, validation rules, and error envelopes are documented in [`docs/lab-02/api-spec.md`](docs/lab-02/api-spec.md).

---

## Tests

```sh
pnpm --filter server test          # Supertest API integration tests (Vitest)
pnpm --filter client test          # Vitest UI tests
pnpm --filter client test:e2e      # Playwright E2E (auto-boots API + Vite)
```

> `test:e2e` spins up both the Express API and the Vite dev server via Playwright's `webServer`, then runs `client/tests/e2e/flow.spec.ts` across desktop / tablet / mobile viewports. Requires a running PostgreSQL (`docker compose up -d`).