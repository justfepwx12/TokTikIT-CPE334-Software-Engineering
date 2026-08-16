# Lab 1 — AI Use and Reflection

**LLM/agent used:** Gemini 3.6 Thinking

## Selected key prompts (6-10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Summarize Lab 1 requirements and suggest an implementation order for GitHub Issues. | Used the suggested breakdown to set up the GitHub Project board and sub-issues. |
| 2 | Generate base configuration files and directory structure for a Monorepo (React + Express + Prisma). | Placed the initial scaffolded files into the repository and reviewed base configuration settings. |
| 3 | Address PR review feedback for Issue 1 (remove redundant configs and fix tsconfig). | Checked for stray files (such as `server/vite.config.ts`), deleted them, and updated workspace configurations. |
| 4 | Design the Prisma Category schema and generate an idempotent seed script. | Created the database migration and executed the seed script to populate the 4 initial categories. |
| 5 | Implement the Express `GET /api/categories` endpoint and Supertest checks for ID ordering. | Connected the endpoint to Prisma queries and wrote Supertest assertions to verify response ordering. |
| 6 | Build the React Category list component supporting Loading and Error states. | Integrated the component with live API calls and implemented UI state indicators. |
| 7 | Debug failing Vitest integration tests in `App.test.tsx` regarding async state and DOM pollution. | Added `cleanup()` in `afterEach` and refactored queries to `findByRole`/`findByText` to properly handle async UI transitions. |

## Reflection
Using an AI assistant significantly accelerated the initial project setup and Kanban workflow organization, especially for boilerplate tasks like Prisma schema design and seed data creation. 

However, the generated output was not 100% accurate and required careful inspection and hands-on debugging. For instance, in Issue 1, the AI created an unnecessary `server/vite.config.ts` file that was flagged during peer review. In Issue 4, the initial Vitest run failed because the AI omitted DOM cleanup routines and did not wait for async state resolution when querying interactive elements. Resolving these failures required analyzing terminal error logs, checking actual DOM outputs, and fine-tuning regex matchers (such as resolving the `TokTickIT` spelling mismatch). Working with AI tools requires active verification and manual debugging rather than blindly accepting generated code.