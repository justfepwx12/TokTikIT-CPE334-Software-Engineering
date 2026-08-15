# Lab 1 – Test Plan and Evidence

All test files live under server/tests/lab-01/ and client/tests/lab-01/.

| # | Tool | Test | Result |
|---|------|------|--------|
| 1 | Supertest | GET /api/health returns 200, status=ok | Pass |
| 2 | Supertest | GET /api/categories returns 4 seeded categories in id order | |
| 3 | Vitest | Heading renders | Pass |
| 4 | Vitest | Success state shows Online + category list | |
| 5 | Vitest | Error state shows Offline + message | |

Paste your passing terminal output / screenshot below:

#1 GET /api/health returns 200, status=ok
client test
$ pnpm test
$ vitest run

 RUN  v1.6.1 C:/Users/ACER/OneDrive/Documents/GitHub/TokTikIT-CPE334-Software-Engineering/client

 ✓ tests/App.test.tsx (3)
   ✓ App (3)
     ✓ renders the TokTikIT heading
     ↓ shows Online and the seeded categories on success [skipped]
     ↓ shows an Offline error message when the API is unavailable [skipped]

 Test Files  1 passed (1)
      Tests  1 passed | 2 todo (3)
   Start at  20:03:03
   Duration  2.00s (transform 61ms, setup 0ms, collect 264ms, tests 37ms, environment 1.23s, prepare 192ms)

server test
$ pnpm test
$ vitest run

 RUN  v1.6.1 C:/Users/ACER/OneDrive/Documents/GitHub/TokTikIT-CPE334-Software-Engineering/server

 ✓ tests/health.test.ts (1)
   ✓ GET /api/health (1)
     ✓ returns HTTP 200 and expected health check payload

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  19:38:18
   Duration  1.08s (transform 163ms, setup 0ms, collect 580ms, tests 19ms, environment 0ms, prepare 212ms)

