# Lab 1 — Peer Review Record

**Author:** Onsinee Chotchuangsakulchai — 67070501078 — GitHub: @justfepwx12
**Peer reviewer:** Nakagamon Saengdara — 67070501064 — GitHub: @fahsai-02

## Pull Requests I authored (reviewed by my partner)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| #22 | feature/1-project-foundation | Changes requested -> Approved |
| | feature/2-health-check | Pending |
| | feature/3-category-seed | Pending |
| | feature/4-category-list | Pending |

**Reviewer comment I received:**
> Requested fixes for blocking issues (empty `server/tsconfig.json`, stray `server/viteconfig.ts`, broken `pnpm-workspace.yaml`), CI test script (`vitest run`), lockfile duplication, README code block formatting, and docs templates.

**How I responded:**
> Added `server/tsconfig.json`, deleted `server/viteconfig.ts`, corrected `pnpm-workspace.yaml`, changed test script to `vitest run`, re-generated clean `pnpm-lock.yaml`, cleaned boilerplate files, and filled docs templates

## Pull Requests I reviewed for my partner
**My comment:**
> Requested changes on `feature/1-project-foundation` due to missing `docs/lab-01/` and `server/tests/lab-01/` folders, failing test runner on server, and corrupted `server/pnpm-lock.yaml` (Also reported incomplete frontend integration on `feature/2-health-check`)

**Partner's response:**
> Added the required folder structures, fixed test configuration, re-generated `pnpm-lock.yaml`, and submitted updated commits for re-review
