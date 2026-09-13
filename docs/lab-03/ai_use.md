# Lab 3 — การใช้ AI และการสะท้อนผล (AI Use and Reflection)

**LLM/agent ที่ใช้:** ใช้ผสมกันระหว่าง Gemini 3.1 Pro (สำหรับร่างเอกสารชุดแรกและดึงข้อมูลจาก GitHub Issues) และ Claude Sonnet (สำหรับตรวจสอบความถูกต้อง แก้ไขรายละเอียด และเทียบ spec กับ labsheet)

## Prompt สำคัญที่เลือกมา (6-10 ข้อ)

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | อ่าน Issue 1 (#77) และ sub-issue #87/#88/#89 ผ่าน `gh issue view` เพื่อดึง scope, details และ acceptance criteria ของ Spec-DD | ได้ขอบเขตเอกสาร Lab 3 ที่ต้องร่างทั้ง 4 ไฟล์ และ step ที่ต้องทำเรียงตาม sub-issue |
| 2 | วิเคราะห์โครงสร้างเอกสาร Lab 2 (`specification.md`, `ui-spec.md`, `api-spec.md`, `tests.md`) เพื่อใช้เป็น convention ของ Lab 3 | ได้แม่แบบหัวข้อ/รูปแบบตาราง (FR/BR/AC/AD, authorization matrix, traceability) ที่จะร่างต่อ |
| 3 | สั่งให้ร่าง `docs/lab-03/specification.md` ตาม convention Lab 2 พร้อม business rules ที่กำหนด (auth/security, admin guard, dual-priority, workflow 8 สถานะ, communication engine) | ได้ฉบับร่าง engineering contract ครบทั้ง transition matrix, authorization matrix, FR-01–FR-24, BR-01–BR-21, AC-01–AC-33 |
| 4 | สั่งให้ร่าง `docs/lab-03/api-spec.md` ให้ครอบคลุม auth, staff queue, claim/assign, it-priority, status, resolve-intent, comments/notes และ admin user management พร้อม error codes | ได้สเปก REST ครบทุก endpoint พร้อม payload schema และกฎ 400/401/403/404/409 ที่ยึด BR-02/BR-06 |
| 5 | สั่งให้ร่าง `docs/lab-03/ui-spec.md` ครอบคลุมทุกหน้าจอใหม่ + reuse token Zen Green เดิมจาก Lab 2 | ได้สเปก UI ครบ (Login, change-password, role-aware shell, queue, detail, comments/notes, admin) พร้อม state rules |
| 6 | สั่งให้สร้าง `docs/lab-03/tests.md` ผูก AC-01–AC-33 กับ planned tests ตาม path ที่ Issue #89 กำหนด | ได้ traceability matrix 66 เทสต์ ครบ 6 ระดับ และ path `server/tests/lab-03/`, `client/src/__tests__/lab-03/`, `e2e/lab-03/` |
| 7 | ตรวจความสอดคล้องข้ามไฟล์ (FR/BR/AC numbering, transition matrix ตรง BR-15, authz matrix ตรง BR-05/BR-07, ทุก AC อยู่ใน traceability) | ได้รับช่องโหว่ที่ต้องแก้ เช่น เพิ่ม decision log และเติม sub-issue mapping ให้ครบก่อนยืนยันฉบับสุดท้าย |

## Reflection



---

