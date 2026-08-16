# Lab 1 – Test Plan and Evidence

All test files live under `server/tests/lab-01/` and `client/tests/lab-01/`.

| # | Related Issue | Tool | Test | Result |
|---|---------------|------|------|--------|
| 1 | Issue 2 | Supertest | GET /api/health returns 200, status=ok | Pass |
| 2 | Issue 4 | Supertest | GET /api/categories returns 4 seeded categories in id order | Pass |
| 3 | Issue 4 | Vitest | Heading renders | Pass |
| 4 | Issue 4 | Vitest | Success state shows Online + category list | Pass |
| 5 | Issue 4 | Vitest | Error state shows Offline + message | Pass |

---

Paste your passing terminal output / screenshot below:

### Issue 2: Implement the API health check
**Test File:** `server/tests/lab-01/health.test.ts`

```text
$ pnpm test
$ vitest run

 RUN  v1.6.1 C:/Users/ACER/OneDrive/Documents/GitHub/TokTikIT-CPE334-Software-Engineering/server

 ✓ tests/lab-01/health.test.ts (1)
   ✓ GET /api/health (1)
     ✓ returns HTTP 200 and expected health check payload

Test Files  1 passed (1)
     Tests  1 passed (1)
```

### Issue 4: Display the IT request category list Backend API Test
**Test File:** `server/tests/lab-01/categories.test.ts`

```text
$ pnpm test
$ vitest run

 RUN  v1.6.1 C:/Users/ACER/OneDrive/Documents/GitHub/TokTikIT-CPE334-Software-Engineering/server

 ✓ tests/lab-01/categories.test.ts (1)
   ✓ GET /api/categories (1)
     ✓ returns 4 seeded categories ordered by id

Test Files  1 passed (1)
     Tests  1 passed (1)
```

### Issue 4: Frontend UI Integration Test
**Test File:** `client/tests/lab-01/App.test.tsx`

```text
$pnpm test$ vitest run

 RUN  v1.6.1 C:/Users/ACER/OneDrive/Documents/GitHub/TokTikIT-CPE334-Software-Engineering/client

 ✓ tests/lab-01/App.test.tsx (3)
   ✓ App (3)
     ✓ renders the TokTickIT heading
     ✓ shows Online and the seeded categories on success
     ✓ shows an Offline error message when the API is unavailable

Test Files  1 passed (1)
     Tests  3 passed (3)
```