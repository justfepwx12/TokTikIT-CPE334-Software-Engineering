# Lab 4 — Issue Tracker (Docs Scaffold)

> Source of truth: GitHub Issues #124–#145 (`label:lab4`) | Flow: `feature/lab4-* -> lab4-staging -> main`

## Epic map
| Epic | Issue | Sub-issues |
|------|-------|------------|
| 1 Spec DD & Contract | #124 | #131 (1.1 spec), #130 (1.2 api+ui), #132 (1.3 tests+formulas) |
| 2 DB & Migration | #125 | #133 (2.1 schema), #134 (2.2 seed) |
| 3 API & Concurrency | #126 | #135 (3.1 CRUD+AuthZ), #136 (3.2 dashboard), #137 (3.3 concurrency) |
| 4 UI Zen Green | #127 | #139 (4.1 staff), #138 (4.2 requester), #140 (4.3 actions), #141 (4.4 polish) |
| 5 Test & Regression | #128 | #142 (5.1 backend), #143 (5.2 frontend) |
| 6 Workflow & PDF | #129 | #144 (6.1 kanban/branch), #145 (6.2 PDF) |

## Excluded Scope (forbidden)
SLA auto-calc / on-call, Email/SMS/LINE/Push, Inventory/Purchase/Cost, Time-sheet/Payroll,
Multi-step approval/e-signature, Advanced BI/custom report/Export, Multi-tenant Production.

## How to Pick Up Work
```bash
git fetch origin && git checkout lab4-staging && git pull
git checkout -b feature/lab4-01-spec-dd lab4-staging
gh issue develop 131 --checkout
# work -> PR into lab4-staging -> link issue -> merge
```
