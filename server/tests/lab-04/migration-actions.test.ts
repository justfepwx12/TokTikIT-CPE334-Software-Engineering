import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();

// Lab 4 tests.md rows 1–2 (AC-56, AC-57) — Migration + Seed safety.
// Needs a database (like lab-03/migration-seed.test.ts). Scoped to
// seed-owned rows (ticketNo + seed: keys) so parallel API-test files cannot
// shake the counts. Verifies:
// - Row 1: only new tables added, legacy untouched, pre-Lab-4 tickets read
//   zero actions.
// - Row 2: seed twice → identical counts; all 8 states; 0/1/N coverage;
//   zero + non-zero dashboard fixtures.

const SEED_TICKET_NOS = [
  "TK-20260820-0001",
  "TK-20260820-0002",
  "TK-20260821-0003",
  "TK-20260822-0004",
  "TK-20260823-0005",
  "TK-20260825-0006",
  "TK-20260826-0007",
  "TK-20260827-0008",
];

const ALL_STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
] as const;

describe("Lab 4 migration & seed safety (AC-56, AC-57)", () => {
  it("adds only ActionTaken + IdempotencyKey tables; legacy tables untouched (AC-56, BR-31)", async () => {
    // New tables exist and are queryable.
    const [actionCount, keyCount] = await Promise.all([
      prisma.actionTaken.count(),
      prisma.idempotencyKey.count(),
    ]);
    expect(typeof actionCount).toBe("number");
    expect(typeof keyCount).toBe("number");

    // Legacy tables still exist with rows (seeded reference data intact).
    const [users, tickets, categories, systems, comments, notes] = await Promise.all([
      prisma.user.count(),
      prisma.ticket.count(),
      prisma.category.count(),
      prisma.relatedSystem.count(),
      prisma.comment.count(),
      prisma.internalNote.count(),
    ]);
    expect(users).toBeGreaterThan(0);
    expect(tickets).toBeGreaterThan(0);
    expect(categories).toBeGreaterThanOrEqual(4);
    expect(systems).toBeGreaterThanOrEqual(6);
    expect(comments).toBeGreaterThan(0);
    expect(notes).toBeGreaterThan(0);

    // information_schema: Ticket must NOT gain Lab-4 scalar columns —
    // actions live in their own table (BR-31 zero alterations).
    const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Ticket'`;
    const names = cols.map((c) => c.column_name);
    // NOTE: Ticket.description is a legitimate Lab 2 field (schema.prisma
    // Ticket.description) also present on ActionTaken — it is NOT a Lab 4
    // leak, so it is excluded here. Only ActionTaken-only columns are listed.
    for (const leaked of ["actionAt", "result", "performedById", "followUpRequired", "followUpNote", "attachmentNotes", "version", "seedKey"]) {
      // seedKey exists on Comment/InternalNote/ActionTaken — never on Ticket.
      if (leaked === "seedKey") {
        expect(names).not.toContain(leaked);
      } else {
        expect(names).not.toContain(leaked);
      }
    }
    // New-table indexes exist (AC-56 §9.4).
    const idx = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes WHERE tablename IN ('ActionTaken', 'IdempotencyKey')`;
    const idxNames = idx.map((r) => r.indexname);
    expect(idxNames).toEqual(
      expect.arrayContaining([
        "ActionTaken_ticketId_idx",
        "ActionTaken_performedById_idx",
        "ActionTaken_actionAt_idx",
        "IdempotencyKey_ticketId_key_key",
      ]),
    );
  });

  it("pre-Lab-4 tickets read back with zero actions (AC-56 valid empty state)", async () => {
    // TK-20260820-0001 ships with no actions by design (0-action bucket).
    const bare = await prisma.ticket.findUniqueOrThrow({
      where: { ticketNo: "TK-20260820-0001" },
      include: { actionsTaken: { select: { id: true } } },
    });
    expect(bare.actionsTaken).toEqual([]);

    // A user-authored ticket created without actions is equally valid.
    const zeroActionTickets = await prisma.actionTaken.groupBy({ by: ["ticketId"], _count: true });
    const withActions = new Set(zeroActionTickets.map((g) => g.ticketId));
    const seedRows = await prisma.ticket.findMany({
      where: { ticketNo: { in: SEED_TICKET_NOS } },
      select: { id: true, ticketNo: true },
    });
    const zeroBucket = seedRows.filter((t) => !withActions.has(t.id));
    expect(zeroBucket.length).toBeGreaterThan(0);
  });

  it("seed covers all 8 states plus 0/1/N action buckets (AC-57)", async () => {
    const seedRows = await prisma.ticket.findMany({
      where: { ticketNo: { in: SEED_TICKET_NOS } },
      select: { id: true, status: true },
    });
    expect(seedRows.length).toBe(SEED_TICKET_NOS.length);
    const statuses = [...new Set(seedRows.map((t) => t.status))].sort();
    expect(statuses).toEqual([...ALL_STATUSES].sort());

    const perTicket = await prisma.actionTaken.groupBy({
      by: ["ticketId"],
      where: { ticketId: { in: seedRows.map((t) => t.id) } },
      _count: true,
    });
    const counts = new Map(perTicket.map((g) => [g.ticketId, g._count]));
    let zero = 0;
    let one = 0;
    let many = 0;
    for (const t of seedRows) {
      const n = counts.get(t.id) ?? 0;
      if (n === 0) zero += 1;
      else if (n === 1) one += 1;
      else many += 1;
    }
    expect(zero).toBeGreaterThan(0);
    expect(one).toBeGreaterThan(0);
    expect(many).toBeGreaterThan(0);

    // followUpRequired true and false cases both seeded.
    const flags = await prisma.actionTaken.groupBy({
      by: ["followUpRequired"],
      where: { ticketId: { in: seedRows.map((t) => t.id) } },
      _count: true,
    });
    const flagValues = flags.map((f) => f.followUpRequired);
    expect(flagValues).toContain(true);
    expect(flagValues).toContain(false);

    // Dashboard fixtures: busaba owns zero tickets; sirichai owns ≥ 1.
    const busaba = await prisma.user.findUniqueOrThrow({ where: { email: "busaba.jitdee@toktikit.com" } });
    const sirichai = await prisma.user.findUniqueOrThrow({ where: { email: "sirichai.thongdee@toktikit.com" } });
    const [busabaTickets, sirichaiTickets] = await Promise.all([
      prisma.ticket.count({ where: { requesterId: busaba.id } }),
      prisma.ticket.count({ where: { requesterId: sirichai.id } }),
    ]);
    expect(busabaTickets).toBe(0);
    expect(sirichaiTickets).toBeGreaterThan(0);
  });

  it("re-running prisma db seed is idempotent for actions (AC-57)", { timeout: 60000 }, async () => {
    const seedIds = (
      await prisma.ticket.findMany({ where: { ticketNo: { in: SEED_TICKET_NOS } }, select: { id: true } })
    ).map((t) => t.id);

    const before = {
      tickets: seedIds.length,
      actions: await prisma.actionTaken.count({ where: { ticketId: { in: seedIds } } }),
      seededActions: await prisma.actionTaken.count({
        where: { ticketId: { in: seedIds }, seedKey: { startsWith: "seed:" } },
      }),
    };

    execSync("pnpm --filter server exec prisma db seed", { stdio: "pipe" });

    const afterIds = (
      await prisma.ticket.findMany({ where: { ticketNo: { in: SEED_TICKET_NOS } }, select: { id: true } })
    ).map((t) => t.id);
    const after = {
      tickets: afterIds.length,
      actions: await prisma.actionTaken.count({ where: { ticketId: { in: afterIds } } }),
      seededActions: await prisma.actionTaken.count({
        where: { ticketId: { in: afterIds }, seedKey: { startsWith: "seed:" } },
      }),
    };

    expect(after.tickets).toBe(before.tickets);
    expect(after.actions).toBe(before.actions);
    expect(after.seededActions).toBe(before.seededActions);
  });

  it("re-seed preserves user-recorded actions (AC-57 data preservation)", { timeout: 60000 }, async () => {
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { ticketNo: "TK-20260820-0001" } });
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: "somchai.jaidee@toktikit.com" } });

    // A real action has no seedKey, so re-seed must leave it intact.
    const userAction = await prisma.actionTaken.create({
      data: {
        ticketId: ticket.id,
        actionAt: new Date("2026-09-25T02:00:00.000Z"),
        description: "user-recorded action",
        result: "done",
        performedById: staff.id,
        followUpRequired: false,
      },
    });

    try {
      execSync("pnpm --filter server exec prisma db seed", { stdio: "pipe" });
      const survived = await prisma.actionTaken.findUnique({ where: { id: userAction.id } });
      expect(survived).toBeTruthy();
      expect(survived?.description).toBe("user-recorded action");
    } finally {
      await prisma.actionTaken.deleteMany({ where: { id: userAction.id } });
    }
  });
});
