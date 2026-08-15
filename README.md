# TokTikIT-CPE334-Software-Engineering

TokTikIT is a web-based IT request and ticketing management system developed as part the CPE334 Software Engineering course at KMUTT. 
Lab 1 delivers a full-stack vertical slice: **React UI → Express REST API → Prisma ORM → PostgreSQL**.

---

## Tech Stack

**Frontend (Client)**
* [React](https://react.dev/) - UI Library
* [TypeScript](https://www.typescriptlang.org/) - Programming Language
* [Vite](https://vitejs.dev/) - Build Tool & Development Server
* [Bootstrap](https://getbootstrap.com/) - CSS Framework for UI components

**Backend (Server)**
* [Node.js](https://nodejs.org/) (v24) & [Express](https://expressjs.com/) - Web Framework
* [TypeScript](https://www.typescriptlang.org/) - Programming Language
* [PostgreSQL](https://www.postgresql.org/) (v17) - Relational Database
* [Prisma](https://www.prisma.io/) - Next-generation ORM

**Testing & Tooling**
* [Vitest](https://vitest.dev/) & [Supertest](https://github.com/ladjs/supertest) - Unit and Integration Testing
* [pnpm](https://pnpm.io/) (v11.20) - Fast, disk-space efficient package manager
* [Docker](https://www.docker.com/) - Containerization for local PostgreSQL database

---

## Repository Structure

```bash
TokTikIT-CPE334-Software-Engineering/
├── client/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── api.ts
│   │   ├── App.css
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── main.tsx
│   │   └── vite-env.d.ts
│   ├── tests/
│   │   └── lab-01/
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   │   ├── index.ts
│   │   └── routes/
│   ├── tests/
│   │   └── lab-01/
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── docs/
│   └── lab-01/
│       ├── ai_use.md
│       ├── reviewer.md
│       └── tests.md
├── docker-compose.yml
├── .gitignore
└── README.md
```

## Setup Guide

1. Prerequisites
Ensure you have the following installed on your local machine:

* Node.js (v24 or higher)
* pnpm (v11.20 or higher)
* PostgreSQL (Installed and running (for local PostgreSQL container))

2. Installation
Clone the repository and install dependencies for both server and client:
```sh
git clone [https://github.com/justfepwx12/TokTikIT-CPE334-Software-Engineering.git](https://github.com/justfepwx12/TokTikIT-CPE334-Software-Engineering.git)
cd TokTikIT-CPE334-Software-Engineering

# Install server dependencies
cd server && pnpm install

# Install client dependencies
cd ../client && pnpm install
```

3. Environment Variables
Navigate to the server directory and set up your environment variables:
```sh
# Server configuration (from project root)
cp server/.env.example server/.env

# Client configuration
cp client/.env.example client/.env
```

4. Database Initialization
Start the PostgreSQL container and run Prisma migrations/seed scripts:
```sh
# 1. Start PostgreSQL Container (from root directory)
docker compose up -d

# 2. Run Database Migration and Generate Prisma Client (in server directory)
cd server
pnpm exec prisma generate
pnpm exec prisma migrate dev

# 3. Seed Initial Categories Data
pnpm exec prisma db seed
```

## Running the Application
Run the backend server and frontend client in separate terminal windows:

| App | Command | URL |
|---|---|---|
| Backend | `cd server && pnpm dev` | http://localhost:5000 |
| Frontend | `cd client && pnpm dev` | http://localhost:5173 |


## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Backend status → `{ "status": "ok", "service": "TokTickIT API" }` |
| GET | `/api/categories` | Seeded request categories from PostgreSQL |

## Tests

```sh
cd server && pnpm test    # Supertest API tests (Vitest)
cd client && pnpm test    # Vitest UI tests
```

