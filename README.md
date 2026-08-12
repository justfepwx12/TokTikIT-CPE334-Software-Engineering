### TokTikIT-CPE334-Software-Engineering

TokTikIT is a web-based IT request and ticketing management system developed as part of the CPE334 Software Engineering course. It provides a platform for users to submit IT support tickets and for IT staff to manage, track, and resolve them efficiently.
---
#### 🛠️ Tech Stack

This project is separated into a frontend client and a backend server, utilizing the following technologies:

**Frontend (Client)**
* [React](https://react.dev/) - UI Library
* [TypeScript](https://www.typescriptlang.org/) - Programming Language
* [Vite](https://vitejs.dev/) - Build Tool & Development Server
* [Bootstrap](https://getbootstrap.com/) - CSS Framework for UI components

**Backend (Server)**
* [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/) - Web Framework
* [TypeScript](https://www.typescriptlang.org/) - Programming Language
* [PostgreSQL](https://www.postgresql.org/) - Relational Database
* [Prisma](https://www.prisma.io/) - Next-generation ORM

**Testing & Tooling**
* [Vitest](https://vitest.dev/) & [Supertest](https://github.com/ladjs/supertest) - Unit and Integration Testing
* [pnpm](https://pnpm.io/) - Fast, disk space efficient package manager

---

#### 📂 Project Structure

The repository follows a clear separation of concerns:

```bash
TokTikIT-CPE334-Software-Engineering/
├── client/          # Frontend application (React + Vite)
├── server/          # Backend application (Express + Prisma)
├── docs/            # Project documentation and lab templates
│   └── lab-01/      # Documents specific to Lab 01
├── pnpm-workspace.yaml # pnpm workspace configuration
└── README.md        # Project overview and setup instructions
```

#### Getting Started (Setup Guide)

1. Prerequisites
Ensure you have the following installed on your local machine:

* Node.js (v18 or higher)
* pnpm (npm install -g pnpm)
* PostgreSQL (Running locally or via Docker)

2. Installation
Clone the repository and install all dependencies:

```bash
git clone [https://github.com/justfepwx12/TokTikIT-CPE334-Software-Engineering.git](https://github.com/justfepwx12/TokTikIT-CPE334-Software-Engineering.git)
cd TokTikIT-CPE334-Software-Engineering
pnpm install
```

3. Environment Variables
Navigate to the server directory and set up your environment variables:

```bash
cd server
cp .env.example .env
```

4. Database Initialization
Generate the Prisma Client based on the initial schema:

```bash
# Ensure you are inside the server directory
pnpm prisma generate

## Running the Application
To start the development servers, run both the backend and frontend in separate terminal windows/tabs:
```

* Backend Server (Terminal 1):
```bash
cd server
pnpm dev
Runs on http://localhost:3000
```

* Frontend Client (Terminal 2):
```bash
cd client
pnpm dev
Runs on http://localhost:5173
```

#### Testing
The backend is configured with Vitest for automated testing. To run the test suite:
```bash
cd server
pnpm test run
```
