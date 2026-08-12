# Lab 1 — Test Plan and Evidence

All test files live under server/tests/lab-01/ and client/tests/lab-01/.

| # | Tool | Test | Result |
|---|------|------|--------|
| 1 | Supertest | GET /api/health returns 200, status=ok | Pass |
| 2 | Supertest | GET /api/categories returns 4 seeded categories in id order | |
| 3 | Vitest | Heading renders | |
| 4 | Vitest | Success state shows Online + category list | |
| 5 | Vitest | Error state shows Offline + message | |

Paste your passing terminal output / screenshot below:

```text
 ✓ server/tests/lab-01/app.test.ts (1)
   ✓ Issue 1: GET /api/health returns 200, status=ok

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  18:00:00
   Duration  0.85s