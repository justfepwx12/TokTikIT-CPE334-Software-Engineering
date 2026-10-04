import { defineConfig } from "vitest/config";

// The admin-api race tests (tests/admin-api.test.ts and
// tests/lab-03/admin-api.test.ts) isolate themselves by deactivating every
// other active admin. When files run in parallel they deactivate each
// other's fixtures/sessions and the race assertions flake with 401.
// Run files serially so the default `vitest run` is deterministic.
export default defineConfig({
  test: {
    fileParallelism: false,
    // worker_threads + native modules (Prisma engine) crash intermittently
    // on Windows (STATUS_ACCESS_VIOLATION). Forks isolate each file in its
    // own process and are stable here.
    pool: "forks",
  },
});
