import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import path from "node:path";
import { randomInt } from "node:crypto";
import { existsSync, unlinkSync } from "node:fs";
import { app } from "../src/App.js";
import { getPrisma } from "../src/prisma.js";
import { UPLOADS_DIR } from "../controllers/attachment.controller.js";
import { TEST_PASSWORD, TEST_PASSWORD_HASH, loginAs } from "./helpers.js";

const prisma = getPrisma();

const REQ_A_EMAIL = "attachment-test-a@toktikit.com";
const REQ_B_EMAIL = "attachment-test-b@toktikit.com";
const PNG_BYTES = Buffer.from("fake-png-bytes-for-tests");

const MAX_FILE_SIZE = 5 * 1024 * 1024;

let requesterA: { id: number };
let requesterB: { id: number };
let testCategoryId: number;
let testSystemId: number;
let ownedTicketId: number;
let otherTicketId: number;
let capacityTicketId: number;
let agentA: Awaited<ReturnType<typeof loginAs>>;
let agentB: Awaited<ReturnType<typeof loginAs>>;

const createdAttachmentIds: number[] = [];

function makeTicketNo(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const nonce = randomInt(1000, 10000);
  return `TK-${date}-${String(nonce).padStart(4, "0")}`;
}

async function createTicket(requesterId: number, title: string): Promise<number> {
  const row = await prisma.ticket.create({
    data: {
      ticketNo: makeTicketNo(),
      title,
      description: "Attachment endpoint regression fixture",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      status: "NEW",
      requesterId,
      categoryId: testCategoryId,
      systemId: testSystemId,
    },
  });
  return row.id;
}

async function upload(
  agent: Awaited<ReturnType<typeof loginAs>>,
  requesterId: number,
  ticketId: number,
  mimetype: string,
  filename: string,
  bytes = PNG_BYTES,
) {
  return agent
    .post("/api/attachments/upload")
    .set("x-requester-id", String(requesterId))
    .field("ticketId", String(ticketId))
    .attach("file", bytes, { filename, contentType: mimetype });
}

describe("Attachments API (api-spec §5)", () => {
  beforeAll(async () => {
    await prisma.attachment.deleteMany({
      where: { ticket: { is: { requester: { is: { email: { in: [REQ_A_EMAIL, REQ_B_EMAIL] } } } } } },
    });
    await prisma.ticket.deleteMany({
      where: { requester: { is: { email: { in: [REQ_A_EMAIL, REQ_B_EMAIL] } } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [REQ_A_EMAIL, REQ_B_EMAIL] } },
    });

    const category = await prisma.category.findFirst({ orderBy: { id: "asc" } });
    const system = await prisma.relatedSystem.findFirst({ orderBy: { id: "asc" } });
    testCategoryId = category!.id;
    testSystemId = system!.id;

    requesterA = await prisma.user.create({
      data: {
        name: "Attachment Test A",
        email: REQ_A_EMAIL,
        isActive: true,
        role: "REQUESTER",
        passwordHash: TEST_PASSWORD_HASH,
        mustChangePassword: false,
      },
    });
    requesterB = await prisma.user.create({
      data: {
        name: "Attachment Test B",
        email: REQ_B_EMAIL,
        isActive: true,
        role: "REQUESTER",
        passwordHash: TEST_PASSWORD_HASH,
        mustChangePassword: false,
      },
    });

    agentA = await loginAs(REQ_A_EMAIL, TEST_PASSWORD);
    agentB = await loginAs(REQ_B_EMAIL, TEST_PASSWORD);

    ownedTicketId = await createTicket(requesterA.id, "Owned Attachment Ticket");
    otherTicketId = await createTicket(requesterB.id, "Other Users Attachment Ticket");
    capacityTicketId = await createTicket(requesterA.id, "Capacity Limit Ticket");
  });

  afterAll(async () => {
    const rows = await prisma.attachment.findMany({
      where: { id: { in: createdAttachmentIds } },
      select: { filePath: true },
    });
    for (const row of rows) {
      const fullPath = path.join(UPLOADS_DIR, row.filePath);
      if (existsSync(fullPath)) unlinkSync(fullPath);
    }

    await prisma.attachment.deleteMany({
      where: { id: { in: createdAttachmentIds } },
    });
    await prisma.ticket.deleteMany({
      where: { requester: { is: { email: { in: [REQ_A_EMAIL, REQ_B_EMAIL] } } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [REQ_A_EMAIL, REQ_B_EMAIL] } },
    });
  });

  describe("POST /api/attachments/upload", () => {
    it("returns 201 with metadata and links the file to the owned ticket", async () => {
      const res = await upload(agentA, requesterA.id, ownedTicketId, "image/png", "evidence.png");
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        filename: "evidence.png",
        mimeType: "image/png",
        size: PNG_BYTES.length,
        ticketId: ownedTicketId,
      });
      expect(typeof res.body.id).toBe("number");
      createdAttachmentIds.push(res.body.id);
    });

    it("uploads multiple allowed types (pdf, jpeg, webp)", async () => {
      const combos: Array<[string, string]> = [
        ["application/pdf", "report.pdf"],
        ["image/jpeg", "photo.jpg"],
        ["image/webp", "preview.webp"],
        ["image/png", "second.png"],
      ];
      for (const [mime, filename] of combos) {
        const res = await upload(agentA, requesterA.id, ownedTicketId, mime, filename);
        expect(res.status).toBe(201);
        createdAttachmentIds.push(res.body.id);
      }
    });

    it("returns 401 when no session is present", async () => {
      const res = await request(app)
        .post("/api/attachments/upload")
        .field("ticketId", String(ownedTicketId))
        .attach("file", PNG_BYTES, { filename: "x.png", contentType: "image/png" });
      expect(res.status).toBe(401);
    });

    it("returns 403 for an inactive or unknown requester", async () => {
      const res = await upload(agentA, 999999, ownedTicketId, "image/png", "x.png");
      expect(res.status).toBe(403);
    });

    it("returns 400 when a file is not provided", async () => {
      const res = await agentA
        .post("/api/attachments/upload")
        .set("x-requester-id", String(requesterA.id))
        .field("ticketId", String(ownedTicketId));
      expect(res.status).toBe(400);
    });

    it("returns 400 for a non-numeric ticketId", async () => {
      const res = await agentA
        .post("/api/attachments/upload")
        .set("x-requester-id", String(requesterA.id))
        .field("ticketId", "abc")
        .attach("file", PNG_BYTES, { filename: "x.png", contentType: "image/png" });
      expect(res.status).toBe(400);
    });

    it("returns 404 when the target ticket does not exist", async () => {
      const res = await upload(agentA, requesterA.id, 99999999, "image/png", "x.png");
      expect(res.status).toBe(404);
    });

    it("returns 403 when uploading to another requester's ticket", async () => {
      const res = await upload(agentA, requesterA.id, otherTicketId, "image/png", "x.png");
      expect(res.status).toBe(403);
    });

    it("returns 415 for a disallowed MIME type", async () => {
      const res = await upload(agentA, requesterA.id, ownedTicketId, "text/plain", "notes.txt");
      expect(res.status).toBe(415);
    });

    it("returns 413 when the file exceeds 5 MB", async () => {
      const res = await upload(
        agentA,
        requesterA.id,
        ownedTicketId,
        "image/png",
        "huge.png",
        Buffer.alloc(MAX_FILE_SIZE + 1),
      );
      expect(res.status).toBe(413);
    });

    it("returns 400 when the ticket already has 5 active attachments", async () => {
      for (let i = 0; i < 5; i++) {
        const res = await upload(agentA, requesterA.id, capacityTicketId, "image/png", `fill-${i}.png`);
        expect(res.status).toBe(201);
        createdAttachmentIds.push(res.body.id);
      }
      const sixth = await upload(agentA, requesterA.id, capacityTicketId, "image/png", "sixth.png");
      expect(sixth.status).toBe(400);
    });

    it("does not leave a physical file behind when validation rejects the upload", async () => {
      const before = await prisma.attachment.count();
      const invalidType = await upload(agentA, requesterA.id, ownedTicketId, "text/plain", "bad.txt");
      expect(invalidType.status).toBe(415);
      const after = await prisma.attachment.count();
      expect(after).toBe(before);

      const beforeOversize = await prisma.attachment.count();
      const oversize = await upload(
        agentA,
        requesterA.id,
        ownedTicketId,
        "image/png",
        "bad.png",
        Buffer.alloc(MAX_FILE_SIZE + 1),
      );
      expect(oversize.status).toBe(413);
      expect(await prisma.attachment.count()).toBe(beforeOversize);
    });
  });

  describe("GET /api/attachments/:id", () => {
    let metaId: number;
    let metaTicketId: number;
    beforeAll(async () => {
      metaTicketId = await createTicket(requesterA.id, "Meta Attachment Ticket");
      const res = await upload(agentA, requesterA.id, metaTicketId, "image/png", "meta.png");
      metaId = res.body.id;
      createdAttachmentIds.push(metaId);
    });

    it("returns 200 with full metadata shape", async () => {
      const res = await agentA
        .get(`/api/attachments/${metaId}`)
        .set("x-requester-id", String(requesterA.id));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: metaId,
        filename: "meta.png",
        mimeType: "image/png",
        size: PNG_BYTES.length,
        ticketId: metaTicketId,
        isRemoved: false,
      });
      expect(res.body.removalReason).toBeNull();
    });

    it("returns 401 without a session", async () => {
      const res = await request(app).get(`/api/attachments/${metaId}`);
      expect(res.status).toBe(401);
    });

    it("returns 403 for another requester's attachment", async () => {
      const res = await agentB
        .get(`/api/attachments/${metaId}`)
        .set("x-requester-id", String(requesterB.id));
      expect(res.status).toBe(403);
    });

    it("returns 404 for a nonexistent attachment id", async () => {
      const res = await agentA
        .get("/api/attachments/99999999")
        .set("x-requester-id", String(requesterA.id));
      expect(res.status).toBe(404);
    });

    it("returns 400 for a non-numeric id", async () => {
      const res = await agentA
        .get("/api/attachments/abc")
        .set("x-requester-id", String(requesterA.id));
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/attachments/:id/download", () => {
    let activeId: number;
    let removedId: number;
    let otherId: number;
    let downloadTicketId: number;

    beforeAll(async () => {
      downloadTicketId = await createTicket(requesterA.id, "Download Attachment Ticket");
      const active = await upload(agentA, requesterA.id, downloadTicketId, "application/pdf", "manual.pdf");
      activeId = active.body.id;
      createdAttachmentIds.push(activeId);

      const removed = await upload(agentA, requesterA.id, downloadTicketId, "image/png", "stale.png");
      removedId = removed.body.id;
      createdAttachmentIds.push(removedId);
      await prisma.attachment.update({
        where: { id: removedId },
        data: { isRemoved: true, removedAt: new Date(), removalReason: "Superseded by v2" },
      });

      const other = await upload(agentB, requesterB.id, otherTicketId, "image/png", "other.png");
      otherId = other.body.id;
      createdAttachmentIds.push(otherId);
    });

    it("streams the binary file with correct type and filename for an active attachment", async () => {
      const res = await agentA
        .get(`/api/attachments/${activeId}/download`)
        .set("x-requester-id", String(requesterA.id));
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
      expect(res.headers["content-disposition"]).toContain("manual.pdf");
      expect(res.body).toBeInstanceOf(Buffer);
      expect(res.body.toString()).toBe("fake-png-bytes-for-tests");
    });

    it("returns 410 Gone for a soft-removed attachment", async () => {
      const res = await agentA
        .get(`/api/attachments/${removedId}/download`)
        .set("x-requester-id", String(requesterA.id));
      expect(res.status).toBe(410);
    });

    it("returns 403 for another requester's attachment", async () => {
      const res = await agentA
        .get(`/api/attachments/${otherId}/download`)
        .set("x-requester-id", String(requesterA.id));
      expect(res.status).toBe(403);
    });

    it("returns 404 for a nonexistent attachment id", async () => {
      const res = await agentA
        .get("/api/attachments/99999999/download")
        .set("x-requester-id", String(requesterA.id));
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/attachments/:id/remove", () => {
    let targetId: number;
    let otherId: number;
    let removeTicketId: number;

    beforeAll(async () => {
      removeTicketId = await createTicket(requesterA.id, "Remove Attachment Ticket");
      const target = await upload(agentA, requesterA.id, removeTicketId, "image/png", "sensitive.png");
      targetId = target.body.id;
      createdAttachmentIds.push(targetId);

      const other = await upload(agentB, requesterB.id, otherTicketId, "image/png", "other.png");
      otherId = other.body.id;
      createdAttachmentIds.push(otherId);
    });

    it("soft-removes with a mandatory reason and keeps metadata", async () => {
      const res = await agentA
        .patch(`/api/attachments/${targetId}/remove`)
        .set("x-requester-id", String(requesterA.id))
        .send({ removalReason: "Contains sensitive database keys" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: targetId,
        filename: "sensitive.png",
        isRemoved: true,
        removalReason: "Contains sensitive database keys",
      });
      expect(res.body.updatedAt).toBeDefined();

      const dbRow = await prisma.attachment.findUnique({ where: { id: targetId } });
      expect(dbRow!.isRemoved).toBe(true);
      expect(dbRow!.removedAt).not.toBeNull();
    });

    it("still returns metadata via detail and meta endpoints after removal", async () => {
      const detail = await agentA
        .get(`/api/tickets/${removeTicketId}`)
        .set("x-requester-id", String(requesterA.id));
      expect(detail.status).toBe(200);
      const listed = detail.body.attachments.find((a: { id: number }) => a.id === targetId);
      expect(listed).toBeDefined();
      expect(listed.isRemoved).toBe(true);

      const meta = await agentA
        .get(`/api/attachments/${targetId}`)
        .set("x-requester-id", String(requesterA.id));
      expect(meta.status).toBe(200);
      expect(meta.body.isRemoved).toBe(true);
    });

    it("returns 400 when the removal reason is missing", async () => {
      const res = await agentA
        .patch(`/api/attachments/${targetId}/remove`)
        .set("x-requester-id", String(requesterA.id))
        .send({});
      expect(res.status).toBe(400);
    });

    it("returns 400 for a whitespace-only reason", async () => {
      const res = await agentA
        .patch(`/api/attachments/${targetId}/remove`)
        .set("x-requester-id", String(requesterA.id))
        .send({ removalReason: "   " });
      expect(res.status).toBe(400);
    });

    it("returns 400 for a reason shorter than 3 characters", async () => {
      const res = await agentA
        .patch(`/api/attachments/${targetId}/remove`)
        .set("x-requester-id", String(requesterA.id))
        .send({ removalReason: "ab" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for a reason longer than 200 characters", async () => {
      const res = await agentA
        .patch(`/api/attachments/${targetId}/remove`)
        .set("x-requester-id", String(requesterA.id))
        .send({ removalReason: "x".repeat(201) });
      expect(res.status).toBe(400);
    });

    it("returns 403 when trying to remove another requester's attachment", async () => {
      const res = await agentA
        .patch(`/api/attachments/${otherId}/remove`)
        .set("x-requester-id", String(requesterA.id))
        .send({ removalReason: "Not mine to remove" });
      expect(res.status).toBe(403);
    });

    it("returns 404 for a nonexistent attachment id", async () => {
      const res = await agentA
        .patch("/api/attachments/99999999/remove")
        .set("x-requester-id", String(requesterA.id))
        .send({ removalReason: "Does not exist" });
      expect(res.status).toBe(404);
    });
  });
});
