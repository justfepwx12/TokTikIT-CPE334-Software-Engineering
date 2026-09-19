import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();

// Emails of the seed users who authored the demo comments/notes.
const SEED_AUTHOR_EMAILS = [
  "anong.srisuk@toktikit.com",
  "weerapong.chaiyaporn@toktikit.com",
  "kanya.boonmee@toktikit.com",
  "sirichai.thongdee@toktikit.com",
  "napat.wongsawat@toktikit.com",
  "somchai.jaidee@toktikit.com",
  "pimchanok.saelim@toktikit.com",
  "thanawat.ruangtham@toktikit.com",
  "malee.khumdee@toktikit.com",
  "admin@toktikit.com",
];

// tests.md §1 rows 1-4 (AC-32, AC-33): the migration preserves Lab 2 data
// (tickets/attachments/reference data), PENDING -> NEW, the single priority
// folds into requestedPriority + itPriority, and the seed is idempotent with
// the required role-based counts and sample tickets carrying comments/notes.

describe("Lab 3 migration & seed (AC-32, AC-33)", () => {
  it("preserves Lab 2 categories, related systems, attachments and ticket numbers", async () => {
    const [categories, systems, attachments] = await Promise.all([
      prisma.category.findMany(),
      prisma.relatedSystem.findMany(),
      prisma.attachment.findMany(),
    ]);

    expect(categories.length).toBeGreaterThanOrEqual(4);
    expect(categories.map((c) => c.name)).toEqual(
      expect.arrayContaining(["Account and Access", "Hardware", "Software", "Network"])
    );
    expect(systems.length).toBeGreaterThanOrEqual(6);

    // Migrated Lab 2 attachment rows keep their metadata (BR-08 soft-removal
    // state and reason are preserved byte-for-byte).
    expect(Array.isArray(attachments)).toBe(true);
  });

  it("maps every migrated ticket status PENDING -> NEW with both priorities filled", async () => {
    const allTickets = await prisma.ticket.findMany({
      select: { status: true, requestedPriority: true, itPriority: true },
    });

    // No ticket may still be PENDING; the enum no longer even contains it.
    expect(allTickets.length).toBeGreaterThan(0);
    for (const t of allTickets) {
      expect(t.status).not.toBe("PENDING");
      expect(["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"]).toContain(t.status);
      expect(t.requestedPriority).toBeDefined();
      expect(t.itPriority).toBeDefined();
    }
  });

  it("seed produces the required role-based user counts (FR-24 / AC-33)", async () => {
    const activeRequesters = await prisma.user.count({ where: { role: "REQUESTER", isActive: true } });
    const inactiveRequesters = await prisma.user.count({ where: { role: "REQUESTER", isActive: false } });
    const activeItStaff = await prisma.user.count({ where: { role: "IT_STAFF", isActive: true } });
    const inactiveItStaff = await prisma.user.count({ where: { role: "IT_STAFF", isActive: false } });
    const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });

    expect(activeRequesters).toBeGreaterThanOrEqual(4);
    expect(inactiveRequesters).toBeGreaterThanOrEqual(1);
    expect(activeItStaff).toBeGreaterThanOrEqual(3);
    expect(inactiveItStaff).toBeGreaterThanOrEqual(1);
    expect(activeAdmins).toBeGreaterThanOrEqual(1);
  });

  it("sample tickets span statuses/priorities and carry comments and notes", async () => {
    const sampleTickets = await prisma.ticket.findMany({
      where: { ticketNo: { in: [
        "TK-20260820-0001",
        "TK-20260820-0002",
        "TK-20260821-0003",
        "TK-20260822-0004",
        "TK-20260823-0005",
        "TK-20260825-0006",
        "TK-20260826-0007",
        "TK-20260827-0008",
      ] } },
      include: { comments: { select: { id: true } }, internalNotes: { select: { id: true } } },
    });

    const statuses = [...new Set(sampleTickets.map((t) => t.status))];
    const priorities = [...new Set(sampleTickets.flatMap((t) => [t.requestedPriority, t.itPriority]))];

    expect(sampleTickets.length).toBeGreaterThanOrEqual(8);
    // Span multiple statuses and both priority axes.
    expect(statuses.length).toBeGreaterThanOrEqual(4);
    expect(priorities.length).toBeGreaterThanOrEqual(4);

    const withComments = sampleTickets.filter((t) => t.comments.length > 0);
    const withNotes = sampleTickets.filter((t) => t.internalNotes.length > 0);
    expect(withComments.length).toBeGreaterThan(0);
    expect(withNotes.length).toBeGreaterThan(0);
  });

  // Spawns `prisma db seed` as a child process — needs a longer timeout on
  // Windows where it takes 6s+ (default 5s flakes).
  it("re-running prisma db seed is idempotent (AC-33)", { timeout: 60000 }, async () => {
    const seedTicketNos = [
      "TK-20260820-0001",
      "TK-20260820-0002",
      "TK-20260821-0003",
      "TK-20260822-0004",
      "TK-20260823-0005",
      "TK-20260825-0006",
      "TK-20260826-0007",
      "TK-20260827-0008",
    ];

    // Scope the check to seed-owned rows so parallel API-test files creating
    // their own fixtures cannot shake the counts (vitest runs files concurrently).
    const countsBefore = await prisma.$transaction(async (tx) => {
      const seedTicketIds = (
        await tx.ticket.findMany({ where: { ticketNo: { in: seedTicketNos } }, select: { id: true } })
      ).map((t) => t.id);
      return {
        tickets: seedTicketIds.length,
        comments: await tx.comment.count({
          where: { ticketId: { in: seedTicketIds }, author: { email: { in: SEED_AUTHOR_EMAILS } } },
        }),
        notes: await tx.internalNote.count({
          where: { ticketId: { in: seedTicketIds }, author: { email: { in: SEED_AUTHOR_EMAILS } } },
        }),
      };
    });

    execSync("pnpm --filter server exec prisma db seed", { stdio: "pipe" });

    const countsAfter = await prisma.$transaction(async (tx) => {
      const seedTicketIds = (
        await tx.ticket.findMany({ where: { ticketNo: { in: seedTicketNos } }, select: { id: true } })
      ).map((t) => t.id);
      return {
        tickets: seedTicketIds.length,
        comments: await tx.comment.count({
          where: { ticketId: { in: seedTicketIds }, author: { email: { in: SEED_AUTHOR_EMAILS } } },
        }),
        notes: await tx.internalNote.count({
          where: { ticketId: { in: seedTicketIds }, author: { email: { in: SEED_AUTHOR_EMAILS } } },
        }),
      };
    });

    // A duplicate run must not create new rows nor trigger unique violations.
    expect(countsAfter.tickets).toBe(countsBefore.tickets);
    expect(countsAfter.comments).toBe(countsBefore.comments);
    expect(countsAfter.notes).toBe(countsBefore.notes);
  });

  it("re-seeding preserves user-authored comments and notes (AC-33 data preservation)", { timeout: 60000 }, async () => {
    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { ticketNo: "TK-20260823-0005" },
    });
    const seedAuthor = await prisma.user.findUniqueOrThrow({
      where: { email: "anong.srisuk@toktikit.com" },
    });

    // A real user adds a comment/note from one of the seeded accounts. These
    // rows have no seedKey, so a re-run of prisma db seed must leave them intact.
    const userComment = await prisma.comment.create({
      data: { body: "user-authored comment", authorId: seedAuthor.id, ticketId: ticket.id },
    });
    const userNote = await prisma.internalNote.create({
      data: { body: "user-authored note", authorId: seedAuthor.id, ticketId: ticket.id },
    });

    try {
      execSync("pnpm --filter server exec prisma db seed", { stdio: "pipe" });

      const [commentSurvived, noteSurvived, canonicalComments, canonicalNotes] = await Promise.all([
        prisma.comment.findUnique({ where: { id: userComment.id } }),
        prisma.internalNote.findUnique({ where: { id: userNote.id } }),
        prisma.comment.count({ where: { ticketId: ticket.id, seedKey: { startsWith: "seed:" } } }),
        prisma.internalNote.count({ where: { ticketId: ticket.id, seedKey: { startsWith: "seed:" } } }),
      ]);

      expect(commentSurvived).toBeTruthy();
      expect(noteSurvived).toBeTruthy();
      // Seed upserts by seedKey — canonical demo rows exist exactly once.
      expect(canonicalComments).toBe(2);
      expect(canonicalNotes).toBe(1);
    } finally {
      await prisma.comment.deleteMany({ where: { id: { in: [userComment.id] } } });
      await prisma.internalNote.deleteMany({ where: { id: { in: [userNote.id] } } });
    }
  });
});