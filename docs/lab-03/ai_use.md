# Lab 3 — การใช้ AI และการสะท้อนผล (AI Use and Reflection)

**LLM/agent ที่ใช้:** ใช้ opencode โมเดล Muse Spark 1.3 xhigh

## Prompt สำคัญที่เลือกมา (6-10 ข้อ)

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | อ่าน Issue 1 (#77) และ sub-issue #87/#88/#89 ผ่าน `gh issue view` เพื่อดึง scope, details และ acceptance criteria ของ Spec-DD | ได้ขอบเขตเอกสาร Lab 3 ที่ต้องร่างทั้ง 4 ไฟล์ และ step ที่ต้องทำเรียงตาม sub-issue |
| 2 | วิเคราะห์โครงสร้างเอกสาร Lab 2 (`specification.md`, `ui-spec.md`, `api-spec.md`, `tests.md`) เพื่อใช้เป็น convention ของ Lab 3 | ได้แม่แบบหัวข้อ/รูปแบบตาราง (FR/BR/AC/AD, authorization matrix, traceability) ที่จะร่างต่อ |
| 3 | สั่งให้ร่าง `docs/lab-03/specification.md` ตาม convention Lab 2 พร้อม business rules ที่กำหนด (auth/security, admin guard, dual-priority, workflow 8 สถานะ, communication engine) | ได้ฉบับร่าง engineering contract ครบทั้ง transition matrix, authorization matrix, FR-01–FR-24, BR-01–BR-21, AC-01–AC-33 |
| 4 | สั่งให้ร่าง `docs/lab-03/api-spec.md` ให้ครอบคลุม auth, staff queue, claim/assign, it-priority, status, resolve-intent, comments/notes และ admin user management พร้อม error codes | ได้สเปก REST ครบทุก endpoint พร้อม payload schema และกฎ 400/401/403/404/409 ที่ยึด BR-02/BR-06 |
| 5 | สั่งให้ร่าง `docs/lab-03/ui-spec.md` ครอบคลุมทุกหน้าจอใหม่ + reuse token Zen Green เดิมจาก Lab 2 | ได้สเปก UI ครบ (Login, change-password, role-aware shell, queue, detail, comments/notes, admin) พร้อม state rules |
| 6 | สั่งให้สร้าง `docs/lab-03/tests.md` ผูก AC-01–AC-33 กับ planned tests ตาม path ที่ Issue #89 กำหนด | ได้ traceability matrix 66 เทสต์ ครบ 6 ระดับ และ path `server/tests/lab-03/`, `client/tests/lab-03/`, `client/tests/e2e/lab-03/` |
| 7 | สั่งให้สร้างสวีท `server/tests/lab-03/` ที่เหลือ 6 ไฟล์จาก root suites โดยเปลี่ยน fixture emails เป็น `l3-` prefix และขยาย ticket nonce กันชนตอนรันขนาน พร้อมรวม resolve-intent เข้า `priority-status-api.test.ts` | ได้ 8 ไฟล์ 81 เทสผ่าน โดยไม่ชนกับ suites เดิมที่รันพร้อมกัน |
| 8 | สั่งให้เติม `client/tests/lab-03/` (Login/ChangePassword/AppShell/RequesterDetail/AdminUsers/uiStyle) ปรับ assertion ให้ตรงโค้ดปัจจุบัน (เช่น admin เห็นลิงก์ Users) และเขียน `admin-flow.spec.ts` สำหรับ E2E | ได้ client 116/116 และ E2E 18/18 ครบ 3 viewports หลังแก้ logout race กับ row-vs-card บนจอเล็ก |
| 9 | สั่งให้ปรับ UI (ซ่อน Header ตอน logout, ตัด breadcrumb/ไอคอนหน้า Login, เพิ่ม Forgot password ตาม AD-09, ล็อกคอลัมน์ตารางด้วย fixed layout + ellipsis) พร้อมเทสกันถอย | ได้ UI ตรงสเปกโดย client suite ยังเขียวทั้งหมด |
| 10 | สั่งให้ตรวจ `api-spec.md`/`ui-spec.md`/`tests.md` เทียบโค้ดจริงทีละจุด (endpoint/field/path/เลข AC) แล้วแก้ให้ตรงปัจจุบัน | ได้เอกสาร 3 ไฟล์ตรงกับโค้ดที่ merge จริง ไม่มี contract ลอย |

## Reflection

การใช้ AI ช่วยร่างเอกสารชุด Spec-DD ของ Lab 3 (specification.md, api-spec.md, ui-spec.md, tests.md) ช่วยประหยัดเวลาในการจัดโครงสร้างเอกสารและแปลงข้อกำหนดจาก labsheet ให้อยู่ในรูปแบบ engineering contract ได้เร็วขึ้นมาก โดยเฉพาะการร่างตาราง Business Rules (BR-01–BR-21), Acceptance Criteria (AC-01–AC-33) และ Planned-Test 66 ข้อ ที่ต้องผูก traceability ข้าม 4 ไฟล์พร้อมกัน แต่ผลลัพธ์จาก AI ในรอบแรกยังไม่สมบูรณ์และต้องตรวจสอบอย่างละเอียดก่อนนำไปใช้จริง ปัญหาที่พบจริงใน Lab 3 นี้และต้องแก้ไขเองมีทั้ง path ใน `tests.md` ที่เขียนเป็น `client/src/__tests__/lab-03/` กับ `e2e/lab-03/` ซึ่งไม่มีอยู่จริงใน repo (ของจริงคือ `client/tests/lab-03/` กับ `client/tests/e2e/lab-03/`), สเปก `ui-spec.md` ที่อ้างว่า queue rows มีปุ่ม Claim/Priority/Status inline ทั้งที่โค้ดจริงไม่มี (ทุก action อยู่บนหน้า detail), และเลข test row/AC ที่ผูกผิดไฟล์ ทำให้ต้องไล่เทียบโค้ดจริงทีละจุดก่อนยืนยัน

พอถึง phase implement (Issue #78–#84 ทำด้วย OpenCode/Muse Spark) ปัญหาเปลี่ยนจากเรื่องเอกสารเป็นเรื่อง runtime ที่อ่านสเปกอย่างเดียวไม่มีทางเจอ สวีทที่รันขนานกันชน fixture (ticketNo/emails ซ้ำ) ต้องแยก namespace เป็น `l3-` prefix, E2E บน tablet/mobile พังเพราะ selector ของ desktop (`ticket-row` ถูกซ่อนแล้วเหลือแต่ card) กับ race ตอน logout ที่ `ProtectedRoute` แย่ง navigate จน URL กลายเป็น `/login?redirect=...`, และ reviewer (@itspxsh) ตีกลับ PR เกือบทุกอันด้วยประเด็นสเปกจริง (BR-02 safe 401, BR-11 race ต้อง advisory-lock, gate ครบทุก route) ซึ่งทั้งหมดจบได้เพราะรันเทสจริง (server 81/81, client 116/116, E2E 18/18 ครบ 3 viewports) ทุกครั้งก่อนขอ review ใหม่

สิ่งที่ตระหนักได้คือให้ AI ร่างแล้วต้อง verify ย้อนกลับ 3 ชั้นเสมอก่อนสร้าง pull request เทียบ labsheet, เทียบโค้ดจริงใน repo, และรันเทสจริง ข้ามชั้นไหนไปจะกลายเป็นปัญหาแล้วได้รับคอมเมนต์ reviewer จากเพื่อนกลับมาทุกครั้ง

---
