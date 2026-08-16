# Lab 1 — Peer Review Record

**Author:** Onsinee Chotchuangsakulchai — 67070501078 — GitHub: @justfepwx12
**Peer reviewer:** Nakagamon Saengdara — 67070501064 — GitHub: @fahsai-02

## Pull Requests I authored (reviewed by my partner)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| #22 | feature/1-project-foundation | Approved |
| #24 / #26 | feature/2-health-check | Approved |
| #25 | feature/3-category-seed | Approved |
| #27 | feature/4-category-list | Waitting -> Approved |

**Reviewer comment I received:**
> **feature/1-project-foundation:** Requested fixes for blocking issues (empty `server/tsconfig.json`, stray `server/viteconfig.ts`, broken `pnpm-workspace.yaml`), CI test script (`vitest run`), lockfile duplication, README code block formatting, and unused Vite boilerplate. After approval, noted that `pnpm test run` in `README.md` caused Vitest to mistake `run` for a file name and recommended using `pnpm test` instead.
> **feature/2-health-check:** Approved with two minor notes: 1) Branch name was `feature/2-api-health-check` and requested renaming to `feature/2-health-check`. 2) Suggested validating `data.status === "ok"` in `client/src/api.ts` (`checkSystem()`) instead of hardcoding `online: true`.
> **feature/3-category-seed:** Approved with no blocking issues (All acceptance criteria met and tests passed).

**How I responded:**
> **feature/1-project-foundation:** Fixed all blocking issues, removed stray files, updated workspace config and test script to `vitest run`, cleaned up boilerplate files, and acknowledged the README command fix to be included in Issue 2 PR.
> **feature/2-health-check:** Renamed the branch to `feature/2-health-check`, updated `checkSystem()` to validate `data.status === "ok"` from the response body, re-opened PR as #26, and merged into `lab1-staging` upon approval.
> **feature/3-category-seed:** Merged PR #25 into `lab1-staging` after receiving approval.

## Pull Requests I reviewed for my partner
**My comment:**
> **feature/1-project-foundation:** Requested changes due to missing `docs/lab-01/` and `server/tests/lab-01/` folders, test runner failure on server side (`EXIT Code 1`), and corrupted `server/pnpm-lock.yaml`.
> **feature/2-health-check:** Requested changes on Criteria 4 & 5. Backend passed all tests (HTTP 200 OK, JSON structure, Supertest tests passing), but Frontend implementation was incomplete (`checkSystem()` pending implementation in `client/src/api.ts`) and lacked error handling UI fallback.
> **feature/4-category-list (#32):** Approved. Verified all acceptance criteria for Issue #16 with matching local test results (Server: 3 passed, Client: 4 passed). Great job on clean implementation.

**Partner's response:**
> **feature/1-project-foundation:** Added missing `docs/` folder, added test file under `server/tests/lab-01/` for `pnpm test` to pass, and resolved lockfile warning using pnpm 11.20.0.
> **feature/2-health-check:** Connected React page to real `/api/health` endpoint (VITE_API_URL + Vite proxy), added Online/Offline status display with error handling, included Vitest tests for both states, and submitted for final approval (Approved & Merged).
> **feature/4-category-list (#32):** Acknowledged approval and merged PR into `lab1-staging` after receiving approvals.