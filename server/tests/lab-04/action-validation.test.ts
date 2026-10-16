import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ACTION_TEXT_MAX,
  ACTION_FUTURE_SKEW_MS,
  IDEMPOTENCY_KEY_MAX,
  fingerprintAction,
  isValidActionAt,
  validateActionInput,
  type ValidatedActionInput,
} from "../../src/actionValidation.js";

// Lab 4 tests.md row 3 (AC-35) — pure Unit, no database.
// Pins the BR-22 field contract: followUp conditional, 5-min skew window,
// trim/blank rejection. The controller (actions.controller.ts) imports this
// same module, so these tests guard the API without I/O.

const VALID_CREATE = {
  actionAt: "2026-09-10T02:00:00.000Z",
  description: "Restarted the service.",
  result: "Stable for one hour.",
  followUpRequired: false,
};

afterEach(() => {
  vi.useRealTimers();
});

describe("Lab 4 action validation unit (AC-35, BR-22)", () => {
  it("accepts a minimal valid create and normalizes defaults", () => {
    const res = validateActionInput({ ...VALID_CREATE }, false);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.input.actionAt).toBeInstanceOf(Date);
    expect(res.input.description).toBe("Restarted the service.");
    expect(res.input.followUpRequired).toBe(false);
    expect(res.input.followUpNote).toBeNull();
    expect(res.input.attachmentNotes).toBeNull();
  });

  it("omitted followUpRequired defaults to false (BR-22)", () => {
    const { followUpRequired: _omit, ...rest } = VALID_CREATE;
    const res = validateActionInput(rest, false);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.input.followUpRequired).toBe(false);
    expect(res.input.followUpNote).toBeNull();
  });

  it("followUpRequired=true requires a non-blank note; false clears it", () => {
    const missing = validateActionInput({ ...VALID_CREATE, followUpRequired: true }, false);
    expect(missing.ok).toBe(false);

    const blank = validateActionInput(
      { ...VALID_CREATE, followUpRequired: true, followUpNote: "   " },
      false,
    );
    expect(blank.ok).toBe(false);

    const ok = validateActionInput(
      { ...VALID_CREATE, followUpRequired: true, followUpNote: "Recheck tomorrow." },
      false,
    );
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.input.followUpNote).toBe("Recheck tomorrow.");

    // Explicit false with a stale note input still normalizes to null
    // (server clears it — BR-22).
    const cleared = validateActionInput(
      { ...VALID_CREATE, followUpRequired: false, followUpNote: "stale" },
      false,
    );
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(cleared.input.followUpNote).toBeNull();
  });

  it("PATCH without a flag keeps the stored value; true→false clears the note (AD-18)", () => {
    const keepOn = validateActionInput(
      { description: "tweaked" },
      true,
      { followUpRequired: true, followUpNote: "stored note" },
    );
    expect(keepOn.ok).toBe(true);
    if (!keepOn.ok) return;
    // Flag absent → keeps stored true; note absent → keeps stored (no overwrite key).
    expect(keepOn.input.followUpRequired).toBe(true);
    expect(keepOn.input.followUpNote).toBeUndefined();

    const clear = validateActionInput(
      { followUpRequired: false },
      true,
      { followUpRequired: true, followUpNote: "stored note" },
    );
    expect(clear.ok).toBe(true);
    if (!clear.ok) return;
    expect(clear.input.followUpRequired).toBe(false);
    expect(clear.input.followUpNote).toBeNull();

    // PATCH flipping false→true without a note is rejected.
    const missing = validateActionInput(
      { followUpRequired: true },
      true,
      { followUpRequired: false, followUpNote: null },
    );
    expect(missing.ok).toBe(false);
  });

  it("rejects blank / overlong description and result after trim", () => {
    for (const description of ["", "   ", "x".repeat(ACTION_TEXT_MAX + 1)]) {
      const res = validateActionInput({ ...VALID_CREATE, description }, false);
      expect(res.ok).toBe(false);
    }
    for (const result of ["", "   ", "x".repeat(ACTION_TEXT_MAX + 1)]) {
      const res = validateActionInput({ ...VALID_CREATE, result }, false);
      expect(res.ok).toBe(false);
    }
    // Trimmed values are stored trimmed (zod .trim()).
    const trimmed = validateActionInput(
      { ...VALID_CREATE, description: "  hi  ", result: "\n ok \n" },
      false,
    );
    expect(trimmed.ok).toBe(true);
    if (!trimmed.ok) return;
    expect(trimmed.input.description).toBe("hi");
    expect(trimmed.input.result).toBe("ok");
  });

  it("enforces the 5-minute future skew window on actionAt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T12:00:00.000Z"));

    // Exactly now + skew is allowed; beyond is rejected.
    expect(isValidActionAt(new Date(Date.now() + ACTION_FUTURE_SKEW_MS).toISOString())).toBe(true);
    expect(isValidActionAt(new Date(Date.now() + ACTION_FUTURE_SKEW_MS + 1000).toISOString())).toBe(false);
    expect(isValidActionAt(new Date(Date.now() + 60 * 60 * 1000).toISOString())).toBe(false);
    expect(isValidActionAt("not-a-date")).toBe(false);
    expect(isValidActionAt("")).toBe(false);
    expect(isValidActionAt(undefined)).toBe(false);

    const future = validateActionInput(
      { ...VALID_CREATE, actionAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
      false,
    );
    expect(future.ok).toBe(false);
  });

  it("validates attachmentNotes as optional plain text ≤ 2000", () => {
    const over = validateActionInput(
      { ...VALID_CREATE, attachmentNotes: "x".repeat(ACTION_TEXT_MAX + 1) },
      false,
    );
    expect(over.ok).toBe(false);

    const nonString = validateActionInput({ ...VALID_CREATE, attachmentNotes: 123 }, false);
    expect(nonString.ok).toBe(false);

    const empty = validateActionInput({ ...VALID_CREATE, attachmentNotes: "" }, false);
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(empty.input.attachmentNotes).toBeNull();
  });

  it("rejects non-object bodies and ignores immutable/body-inert fields", () => {
    expect(validateActionInput("not-an-object", false).ok).toBe(false);
    expect(validateActionInput(null, false).ok).toBe(false);
    expect(validateActionInput([], false).ok).toBe(false);

    // performedBy/version/id/ticketId in the body have no effect (BR-23, AD-14).
    const res = validateActionInput(
      {
        ...VALID_CREATE,
        performedById: 999999,
        performedBy: { id: 999999 },
        version: 99,
        id: 999999,
        ticketId: 999999,
      },
      false,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.input).not.toHaveProperty("performedById");
    expect(res.input).not.toHaveProperty("version");

    // actionAt is immutable on update — supplied values are ignored, not rejected.
    const patch = validateActionInput(
      { description: "ok result guard", result: "done", actionAt: "2020-01-01T00:00:00.000Z" },
      true,
      { followUpRequired: false, followUpNote: null },
    );
    expect(patch.ok).toBe(true);
    if (!patch.ok) return;
    expect(patch.input.actionAt).toBeUndefined();
  });

  it("PATCH without If-Match-relevant version still validates field rules", () => {
    // Missing description on PATCH is fine (partial update); blank is not.
    const absent = validateActionInput({ result: "done" }, true, {
      followUpRequired: false,
      followUpNote: null,
    });
    expect(absent.ok).toBe(true);

    const blank = validateActionInput({ description: "  " }, true, {
      followUpRequired: false,
      followUpNote: null,
    });
    expect(blank.ok).toBe(false);
  });

  it("fingerprints distinguish payloads and expose the key-length contract", () => {
    const base: ValidatedActionInput = {
      actionAt: new Date("2026-09-10T02:00:00.000Z"),
      description: "a",
      result: "b",
      followUpRequired: false,
      followUpNote: null,
      attachmentNotes: null,
    };
    const same: ValidatedActionInput = { ...base, actionAt: new Date("2026-09-10T02:00:00.000Z") };
    const different: ValidatedActionInput = { ...base, result: "c" };
    expect(fingerprintAction(base)).toBe(fingerprintAction(same));
    expect(fingerprintAction(base)).not.toBe(fingerprintAction(different));
    expect(IDEMPOTENCY_KEY_MAX).toBe(64);
  });
});
