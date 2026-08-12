# Lab 1 — AI Use and Reflection  (fill this in)

All test files live under server/tests/lab-01/ and client/tests/lab-01/.

# Lab 1 — AI Use and Reflection

**LLM/agent used:**  (Gemini 3.6 Thinking)

## Selected key prompts (6-10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Plan Lab 1 implementation and summarize requirements. | Used the suggested order to set up GitHub Project and Issues |
| 2 | Set up full-stack project foundation (React, Express, Prisma). | Reviewed generated configs and structured directory files |
| 3 | Fix PR review feedback for Issue 1 (tsconfig, workspace configs). | Verified generated files, deleted stray configs, and pushed updates |
| 4 | Create Prisma Category schema and seed data. | Generated migration, created seed script, and tested idempotency |


## Reflection
Using an AI agent to set up the project foundation and clarify the Kanban workflow saved a lot of time. However, the generated output still required thorough review, as the AI generated redundant config files (such as server/viteconfig.ts) I had to review the codebase, address the peer reviewer's feedback, and manually double-check everything before merging.

