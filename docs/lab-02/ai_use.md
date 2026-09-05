# Lab 2 — การใช้ AI และการสะท้อนผล (AI Use and Reflection)

**LLM/agent ที่ใช้:** ใช้ผสมกันระหว่าง Gemini 3.1 Pro (สำหรับร่างเอกสารชุดแรกและดึงข้อมูลจาก GitHub Issues) และ Claude Sonnet (สำหรับตรวจสอบความถูกต้อง แก้ไขรายละเอียด และเทียบ spec กับ labsheet)

## Prompt สำคัญที่เลือกมา (6-10 ข้อ)

| # | Prompt (summarised) | What I did with the result |
|---|---------------|----------------------|
| 1 | สั่งให้ Gemini ทำหน้าที่เป็น AI specification agent โดยวางรายละเอียด Issue 5 และ Acceptance Criteria ให้ครบ แล้วให้ร่าง `specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md` เฉพาะส่วนเอกสาร ห้ามเขียนโค้ด implementation, schema, หรือไฟล์ config ใดๆ | ได้โครงร่างเอกสารตั้งต้นทั้ง 4 ไฟล์ ใช้เป็น draft แรกก่อนตรวจสอบเนื้อหาแต่ละส่วนต่อ |
| 2 | สั่งให้รัน `gh issue view 29` เพื่ออ่านบริบท Issue หลักก่อน แล้วให้ Gemini ทำหน้าที่ senior software engineering agent สร้างเนื้อหา markdown เต็มรูปแบบของทั้ง 4 ไฟล์ในโฟลเดอร์ `docs/lab-02/` ให้ตรงกับรายละเอียดใน Issue โดยเขียนไฟล์ตรงและไม่แตะโค้ด implementation | นำเนื้อหาที่ได้มาเทียบกับ labsheet อีกรอบ พบว่าเนื้อหาบางส่วนยังไม่ครบตามที่ sub-issue กำหนด จึงต้องสั่งต่อในรอบถัดไป |
| 3 | แจ้งว่าการสร้างรอบก่อนหน้ายังไม่สมบูรณ์ สั่งให้ตรวจ sub-issue #37, #38, #39, #40 ด้วย `gh issue view` แต่ละอัน แล้วให้เติมเนื้อหาทั้ง 4 ไฟล์ให้ครบตามรายละเอียดใน sub-issue ที่เกี่ยวข้อง ห้ามข้ามไฟล์ใดไฟล์หนึ่ง | ได้เนื้อหาเอกสารฉบับที่ครบขึ้น แต่ยังต้องตรวจสอบมือต่อว่าตรงกับ labsheet จริงหรือไม่ |
| 4 | ให้ Claude เทียบชื่อ endpoint และชื่อ field ใน `api-spec.md` กับที่ labsheet กำหนดไว้ทีละหัวข้อ (Requesters, Categories, Systems, Tickets, Attachments) | พบว่าชื่อ endpoint/field บางจุดไม่ตรงกับที่โจทย์กำหนด แก้ไขให้ตรงตามสเปกด้วยตนเองก่อนยืนยันเป็นฉบับสุดท้าย |
| 5 | ให้ Claude ตรวจว่า `tests.md` ครอบคลุมครบทั้ง 6 ระดับตามข้อ 9.2 ของ labsheet (Unit, API, UI, UI Style, Responsive, E2E) หรือไม่ | พบว่ามีบางระดับ (เช่น UI Style และ Responsive) ยังไม่มี test case ครบ จึงเพิ่ม test case ที่ขาดเข้าไปในตารางและจับคู่กับ AC ที่เกี่ยวข้องใหม่ |
| 6 | ให้ Claude ไล่เช็คเลข Issue ที่อ้างอิงในเอกสารเทียบกับเลข Issue จริงบน GitHub Project | พบว่าเลข Issue ในเอกสารบางจุดไม่สัมพันธ์กับเลขจริงบน GitHub (คลาดเคลื่อนจากการ generate รอบแรก) แก้ไขเลขอ้างอิงให้ตรงกับ Issue จริงในตารางและหัวเอกสาร |
| 7 | ให้ Claude ตรวจ Traceability แบบข้ามเอกสารทั้ง 4 ไฟล์ (`specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`) ว่า header ที่อ้าง FR/BR/AC ตรงกับเนื้อหาจริงในแต่ละไฟล์หรือไม่ และเทียบชื่อไฟล์เทสต์/ชื่อโปรดักต์กับ labsheet ต้นฉบับ | พบช่องโหว่หลายจุด: `api-spec.md` claim ช่วง FR/BR แคบกว่าที่ implement จริงและ over-claim ว่า verify AC-08/AC-09 (ซึ่งเป็นพฤติกรรมฝั่ง frontend ล้วน), `ui-spec.md` ไม่ได้บรรยาย success screen ทั้งที่ทดสอบไว้ใน tests.md, ชื่อไฟล์เทสต์เบี่ยงเบนจากโครงสร้างที่ labsheet §12 กำหนดโดยไม่มีคำอธิบาย, และชื่อโปรดักต์สะกดผิดเป็น "TokTikIT" แทนที่จะเป็น "TokTickIT" ตามต้นฉบับ |
| 8 | ให้ Claude แก้ไขทุกจุดที่ตรวจพบ: ปรับ traceability header ใน `api-spec.md`/`ui-spec.md` ให้ตรงกับเนื้อหาจริง, เติมเนื้อหา success-screen ที่หายไปใน `ui-spec.md`, เพิ่ม AD-12 ใน `specification.md` เพื่อ justify การตั้งชื่อไฟล์เทสต์, และแก้การสะกดชื่อโปรดักต์ให้ตรงทุกไฟล์ | ตรวจสอบทุกจุดที่แก้ด้วยตนเองอีกรอบ (รวมถึงรัน `grep` หาคำที่สะกดผิดที่อาจตกหล่น) ก่อนยืนยันว่าเอกสารทั้ง 4 ไฟล์สอดคล้องกันและพร้อมส่งต่อให้ AI Coding Agent |
| 9 | สั่งให้ Claude นำ `RequesterContext.tsx` มาผูกกับ `App.tsx`, `Header.tsx` และ `RequesterSelection.tsx` เพื่อทำ Protected Route และ Context (Issue #50, #51) ตาม FR-03 และ BR-03 | AI ช่วยรวมโค้ดและสร้างระบบ Protected Route ที่เช็ค state จาก `localStorage` ได้อย่างสมบูรณ์ ทำให้หน้าเว็บเด้งกลับไปหน้าเลือกล็อกอินจำลองได้ถูกต้องหากยังไม่มี Context |

## Reflection

การใช้ AI ช่วยร่างเอกสารชุด Spec-DD (specification.md, api-spec.md, ui-spec.md, tests.md) ช่วยประหยัดเวลาในการจัดโครงสร้างเอกสารและแปลงข้อกำหนดจาก labsheet ให้อยู่ในรูปแบบ engineering contract ได้เร็วขึ้นมาก โดยเฉพาะการร่างตาราง Business Rules, Acceptance Criteria และ Planned-Test ที่มีจำนวนมาก

แต่ผลลัพธ์จาก AI ในรอบแรกยังไม่สมบูรณ์และต้องตรวจสอบอย่างละเอียดก่อนนำไปใช้จริง ปัญหาที่พบและต้องแก้ไขเองมีทั้งชื่อ endpoint/field ใน `api-spec.md` ที่ไม่ตรงกับที่ labsheet กำหนดไว้ ทำให้ต้องไล่เทียบทีละหัวข้อ, ความครอบคลุมของ test case ใน `tests.md` ยังขาดบางระดับตามข้อกำหนด 6 ระดับ (Unit/API/UI/UI Style/Responsive/E2E) ทำให้ต้องเติมเคสที่หายไปเอง และเลข Issue ที่ AI อ้างอิงในเอกสารไม่ตรงกับเลข Issue จริงบน GitHub ซึ่งต้องตรวจทานทีละจุดและแก้ไขให้ตรงกัน

การใช้งาน AI สองตัว (Gemini สำหรับร่างเนื้อหาตั้งต้นและดึงบริบทจาก GitHub, Claude สำหรับตรวจสอบความสอดคล้องและความครบถ้วน) ทำให้เห็นว่าการปล่อยให้ AI generate เอกสารแล้วนำไปใช้ทันทีเสี่ยงผิดพลาดสูง จำเป็นต้องมีขั้นตอนตรวจสอบย้อนกลับไปยัง labsheet และ GitHub Issues จริงทุกครั้ง ก่อนจะยืนยันว่าเอกสารฉบับนั้นพร้อมส่งต่อให้ AI Coding Agent นำไปใช้ implement จริง
