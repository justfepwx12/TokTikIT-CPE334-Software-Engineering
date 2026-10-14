/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup, act } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import * as api from "../../src/api";
import ActionsTaken from "../../src/components/ActionsTaken";
import { AuthProvider } from "../../src/context/AuthContext";

vi.mock("lucide-react", () => ({}) );

const STAFF_USER: api.AuthUser = {
  id: 8, name: "Weerapong Chaiyaporn", email: "weerapong@toktikit.com",
  role: "IT_STAFF", isActive: true, mustChangePassword: false,
};

const REQUESTER_USER: api.AuthUser = {
  id: 6, name: "Jane Doe", email: "jane@toktikit.com",
  role: "REQUESTER", isActive: true, mustChangePassword: false,
};

function actionFixture(id: number, overrides: Partial<api.ActionTaken> = {}): api.ActionTaken {
  return {
    id,
    ticketId: 101,
    actionAt: "2026-09-10T02:00:00.000Z",
    description: `Did the work ${id}.`,
    result: `It worked ${id}.`,
    performedBy: { id: 8, name: "Weerapong Chaiyaporn", role: "IT_STAFF" },
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    version: 1,
    createdAt: "2026-09-10T02:01:00.000Z",
    updatedAt: "2026-09-10T02:01:00.000Z",
    ...overrides,
  };
}

function pageOf(actions: api.ActionTaken[], total: number, page = 1, limit = 20): api.ActionsResponse {
  return { actions, pagination: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

const getActionsMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();

function mockAs(user: api.AuthUser) {
  vi.spyOn(api, "getSessionUser").mockResolvedValue({ user });
  vi.spyOn(api, "getTicketActions").mockImplementation(getActionsMock);
  vi.spyOn(api, "createTicketAction").mockImplementation(createMock);
  vi.spyOn(api, "updateTicketAction").mockImplementation(updateMock);
}

describe("ActionsTaken (AC-50/51/52, AC-37)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    getActionsMock.mockReset();
    createMock.mockReset();
    updateMock.mockReset();
    mockAs(STAFF_USER);
  });

  afterEach(() => {
    cleanup();
  });

  const renderSection = (ticketId = 101) =>
    render(
      <BrowserRouter>
        <AuthProvider>
          <ActionsTaken ticketId={ticketId} />
        </AuthProvider>
      </BrowserRouter>
    );

  it("staff see list + create + edit; requesters see a read-only list (AC-50)", async () => {
    getActionsMock.mockResolvedValue(pageOf([actionFixture(1)], 1));
    renderSection();
    await waitFor(() => expect(screen.getByTestId("actions-list")).toBeDefined());

    expect(screen.getByTestId("action-create-form")).toBeDefined();
    expect(screen.getByTestId("action-recording-as").textContent).toMatch(/Weerapong/);
    expect(screen.getByTestId("action-edit-1")).toBeDefined();

    cleanup();
    vi.restoreAllMocks();
    window.localStorage.clear();
    getActionsMock.mockReset();
    createMock.mockReset();
    updateMock.mockReset();
    mockAs(REQUESTER_USER);
    getActionsMock.mockResolvedValue(pageOf([actionFixture(1)], 1));
    renderSection(102);
    await waitFor(() => expect(screen.getByTestId("actions-list")).toBeDefined());

    // Zero create/edit affordances for requesters.
    expect(screen.queryByTestId("action-create-form")).toBeNull();
    expect(screen.queryByTestId("action-edit-1")).toBeNull();
    expect(screen.queryByTestId("action-card-edit-1")).toBeNull();
    expect(screen.queryByTestId("action-submit")).toBeNull();
  });

  it("empty state copy differs by role; N rows render with follow-up badge", async () => {
    getActionsMock.mockResolvedValue(pageOf([], 0));
    renderSection();
    await waitFor(() => expect(screen.getByTestId("actions-empty")).toBeDefined());
    expect(screen.getByTestId("actions-empty").textContent).toMatch(/No actions recorded yet/);

    cleanup();
    vi.restoreAllMocks();
    window.localStorage.clear();
    getActionsMock.mockReset();
    createMock.mockReset();
    updateMock.mockReset();
    mockAs(STAFF_USER);
    getActionsMock.mockResolvedValue(
      pageOf(
        [
          actionFixture(3),
          actionFixture(2, { followUpRequired: true, followUpNote: "Re-check at end of shift." }),
          actionFixture(1),
        ],
        3
      )
    );
    renderSection(103);
    await waitFor(() => expect(screen.getByTestId("actions-list")).toBeDefined());
    expect(screen.getAllByText("Re-check at end of shift.").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Follow-Up").length).toBeGreaterThanOrEqual(1);
  });

  it("blank fields and missing follow-up note block submit with inline errors (AC-51)", async () => {
    getActionsMock.mockResolvedValue(pageOf([], 0));
    renderSection();
    await waitFor(() => expect(screen.getByTestId("action-create-form")).toBeDefined());

    fireEvent.click(screen.getByTestId("action-submit"));
    await waitFor(() => expect(screen.getByText(/Description must be 1–2000 characters/)).toBeDefined());
    expect(screen.getByText(/Result must be 1–2000 characters/)).toBeDefined();
    expect(createMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("action-description"), { target: { value: "Did the work." } });
    fireEvent.change(screen.getByTestId("action-result"), { target: { value: "It worked." } });
    fireEvent.click(screen.getByTestId("action-followup"));
    fireEvent.click(screen.getByTestId("action-submit"));
    await waitFor(() => expect(screen.getByText(/Follow-up note is required/)).toBeDefined());
    expect(createMock).not.toHaveBeenCalled();
  });

  it("valid submit prepends the new row and clears the draft (AC-51)", async () => {
    getActionsMock.mockResolvedValue(pageOf([], 0));
    const created = actionFixture(9, { description: "Did the work.", result: "It worked." });
    createMock.mockResolvedValue(created);
    renderSection();
    await waitFor(() => expect(screen.getByTestId("action-create-form")).toBeDefined());

    fireEvent.change(screen.getByTestId("action-description"), { target: { value: "Did the work." } });
    fireEvent.change(screen.getByTestId("action-result"), { target: { value: "It worked." } });
    fireEvent.click(screen.getByTestId("action-submit"));

    await waitFor(() => expect(screen.getByTestId("action-row-9")).toBeDefined());
    expect(screen.getByTestId("actions-heading").textContent).toMatch(/\(1\)/);
    // Draft cleared after success.
    expect((screen.getByTestId("action-description") as HTMLTextAreaElement).value).toBe("");
    // Idempotency-Key header carried for the duplicate-submit guard.
    expect(createMock.mock.calls[0][2]).toEqual(expect.any(String));
  });

  it("double submit creates exactly once and a failed save preserves the draft (AC-52)", async () => {
    getActionsMock.mockResolvedValue(pageOf([], 0));
    let resolveCreate!: (v: api.ActionTaken) => void;
    createMock.mockImplementation(() => new Promise<api.ActionTaken>((r) => (resolveCreate = r)));
    renderSection();
    await waitFor(() => expect(screen.getByTestId("action-create-form")).toBeDefined());

    fireEvent.change(screen.getByTestId("action-description"), { target: { value: "Did the work." } });
    fireEvent.change(screen.getByTestId("action-result"), { target: { value: "It worked." } });
    fireEvent.click(screen.getByTestId("action-submit"));
    fireEvent.click(screen.getByTestId("action-submit"));
    resolveCreate(actionFixture(11));
    await waitFor(() => expect(screen.getByTestId("action-row-11")).toBeDefined());
    expect(createMock).toHaveBeenCalledTimes(1);

    // Failed save: draft survives for retry.
    cleanup();
    vi.restoreAllMocks();
    window.localStorage.clear();
    getActionsMock.mockReset();
    createMock.mockReset();
    updateMock.mockReset();
    mockAs(STAFF_USER);
    getActionsMock.mockResolvedValue(pageOf([], 0));
    createMock.mockRejectedValueOnce(new Error("Network down."));
    renderSection(104);
    await waitFor(() => expect(screen.getByTestId("action-create-form")).toBeDefined());
    fireEvent.change(screen.getByTestId("action-description"), { target: { value: "Unsaved draft." } });
    fireEvent.change(screen.getByTestId("action-result"), { target: { value: "Keep me." } });
    fireEvent.click(screen.getByTestId("action-submit"));
    await waitFor(() => expect(screen.getByTestId("action-server-error")).toBeDefined());
    expect((screen.getByTestId("action-description") as HTMLTextAreaElement).value).toBe("Unsaved draft.");
  });

  it("stale edit shows refresh-and-retry; refresh reloads the latest (AC-37)", async () => {    const stored = actionFixture(5, { result: "v2", version: 2 });
    getActionsMock.mockResolvedValue(pageOf([stored], 1));
    updateMock.mockRejectedValueOnce(new api.ApiError(409, "Stale.", "STALE_VERSION", 3));
    renderSection();
    await waitFor(() => expect(screen.getByTestId("action-edit-5")).toBeDefined());

    fireEvent.click(screen.getByTestId("action-edit-5"));
    fireEvent.change(screen.getByTestId("action-edit-result"), { target: { value: "My edit." } });
    fireEvent.click(screen.getByTestId("action-edit-submit"));

    await waitFor(() => expect(screen.getByTestId("action-conflict")).toBeDefined());
    expect(screen.getByTestId("action-conflict").textContent).toMatch(/Someone updated this action/);

    const fresh = actionFixture(5, { result: "Teammate edit.", version: 3 });
    getActionsMock.mockResolvedValueOnce(pageOf([fresh], 1));
    updateMock.mockResolvedValueOnce({ ...fresh, result: "My edit.", version: 4 });
    fireEvent.click(screen.getByTestId("action-conflict-refresh"));

    await waitFor(() => expect((screen.getByTestId("action-edit-result") as HTMLTextAreaElement).value).toBe("Teammate edit."));
    fireEvent.change(screen.getByTestId("action-edit-result"), { target: { value: "My edit." } });
    fireEvent.click(screen.getByTestId("action-edit-submit"));
    await waitFor(() => expect(screen.getByTestId("action-row-5")).toBeDefined());
  });

  it("paginates with Load more instead of infinite scroll", async () => {
    const first20 = Array.from({ length: 20 }, (_, i) => actionFixture(100 - i));
    getActionsMock.mockResolvedValueOnce(pageOf(first20, 25, 1, 20));
    renderSection();
    await waitFor(() => expect(screen.getByTestId("actions-load-more")).toBeDefined());

    const last5 = Array.from({ length: 5 }, (_, i) => actionFixture(80 - i));
    getActionsMock.mockResolvedValueOnce(pageOf(last5, 25, 2, 20));
    fireEvent.click(screen.getByTestId("actions-load-more"));
    await waitFor(() => expect(screen.getByTestId("action-row-76")).toBeDefined());
    expect(screen.queryByTestId("actions-load-more")).toBeNull();
  });

  it("retry after a lost response + remount reuses the same key: exactly one record (BR-28)", async () => {
    getActionsMock.mockResolvedValue(pageOf([], 0));
    // First attempt: the server commits but the response never arrives.
    createMock.mockRejectedValueOnce(new Error("Network down."));
    renderSection(105);
    await waitFor(() => expect(screen.getByTestId("action-create-form")).toBeDefined());

    fireEvent.change(screen.getByTestId("action-description"), { target: { value: "Did the work." } });
    fireEvent.change(screen.getByTestId("action-result"), { target: { value: "It worked." } });
    fireEvent.click(screen.getByTestId("action-submit"));
    await waitFor(() => expect(screen.getByTestId("action-server-error")).toBeDefined());
    expect(createMock).toHaveBeenCalledTimes(1);
    const firstKey = createMock.mock.calls[0][2];
    expect(firstKey).toEqual(expect.any(String));

    // Page reload / remount: the restored draft must carry the same key, so
    // the retry replays the original creation instead of duplicating it.
    cleanup();
    renderSection(105);
    await waitFor(() => expect(screen.getByTestId("action-create-form")).toBeDefined());
    expect((screen.getByTestId("action-description") as HTMLTextAreaElement).value).toBe("Did the work.");

    createMock.mockResolvedValueOnce(actionFixture(21, { description: "Did the work.", result: "It worked." }));
    fireEvent.click(screen.getByTestId("action-submit"));
    await waitFor(() => expect(screen.getByTestId("action-row-21")).toBeDefined());

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(createMock.mock.calls[1][2]).toBe(firstKey);
    expect(screen.getByTestId("actions-heading").textContent).toMatch(/\(1\)/);
  });

  it("switching ticketId without unmount keeps per-ticket drafts and keys isolated", async () => {
    getActionsMock.mockImplementation(async () => pageOf([], 0));
    const view = renderSection(201);
    await waitFor(() => expect(screen.getByTestId("action-create-form")).toBeDefined());

    fireEvent.change(screen.getByTestId("action-description"), { target: { value: "Draft for 201." } });
    fireEvent.change(screen.getByTestId("action-result"), { target: { value: "Result 201." } });
    await waitFor(() =>
      expect(
        (JSON.parse(window.localStorage.getItem("l4-action-draft:201") ?? "null") as { draft?: { description?: string } } | null)?.draft
          ?.description
      ).toBe("Draft for 201.")
    );
    const key201 = (JSON.parse(window.localStorage.getItem("l4-action-draft:201") ?? "null") as { key?: string } | null)?.key;
    expect(typeof key201).toBe("string");

    // Navigate Ticket 201 -> 202 while ActionsTaken stays mounted.
    view.rerender(
      <BrowserRouter>
        <AuthProvider>
          <ActionsTaken ticketId={202} />
        </AuthProvider>
      </BrowserRouter>
    );
    await waitFor(() => expect(screen.getByTestId("action-create-form")).toBeDefined());
    // New ticket must not show the previous ticket's draft.
    expect((screen.getByTestId("action-description") as HTMLTextAreaElement).value).toBe("");
    // The switch itself must not overwrite either storage entry.
    expect(
      (JSON.parse(window.localStorage.getItem("l4-action-draft:201") ?? "null") as { draft?: { description?: string } } | null)?.draft
        ?.description
    ).toBe("Draft for 201.");

    fireEvent.change(screen.getByTestId("action-description"), { target: { value: "Draft for 202." } });
    fireEvent.change(screen.getByTestId("action-result"), { target: { value: "Result 202." } });
    await waitFor(() =>
      expect(
        (JSON.parse(window.localStorage.getItem("l4-action-draft:202") ?? "null") as { draft?: { description?: string } } | null)?.draft
          ?.description
      ).toBe("Draft for 202.")
    );
    const key202 = (JSON.parse(window.localStorage.getItem("l4-action-draft:202") ?? "null") as { key?: string } | null)?.key;
    expect(typeof key202).toBe("string");
    expect(key202).not.toBe(key201);
    // Editing ticket 202 must leave ticket 201's stored draft untouched.
    expect(
      (JSON.parse(window.localStorage.getItem("l4-action-draft:201") ?? "null") as { draft?: { description?: string } } | null)?.draft
        ?.description
    ).toBe("Draft for 201.");

    // Switch back: ticket 201 restores its own draft and key.
    view.rerender(
      <BrowserRouter>
        <AuthProvider>
          <ActionsTaken ticketId={201} />
        </AuthProvider>
      </BrowserRouter>
    );
    await waitFor(() => expect(screen.getByTestId("action-create-form")).toBeDefined());
    expect((screen.getByTestId("action-description") as HTMLTextAreaElement).value).toBe("Draft for 201.");
    expect((JSON.parse(window.localStorage.getItem("l4-action-draft:201") ?? "null") as { key?: string } | null)?.key).toBe(
      key201
    );

    // Each ticket submits with its own key.
    createMock.mockImplementation(async (tid: number) =>
      actionFixture(tid === 201 ? 31 : 32, {
        ticketId: tid,
        description: tid === 201 ? "Draft for 201." : "Draft for 202.",
        result: tid === 201 ? "Result 201." : "Result 202.",
      })
    );
    fireEvent.click(screen.getByTestId("action-submit"));
    await waitFor(() => expect(screen.getByTestId("action-row-31")).toBeDefined());
    expect(createMock.mock.calls[0][0]).toBe(201);
    expect(createMock.mock.calls[0][2]).toBe(key201);

    view.rerender(
      <BrowserRouter>
        <AuthProvider>
          <ActionsTaken ticketId={202} />
        </AuthProvider>
      </BrowserRouter>
    );
    await waitFor(() => expect(screen.getByTestId("action-create-form")).toBeDefined());
    expect((screen.getByTestId("action-description") as HTMLTextAreaElement).value).toBe("Draft for 202.");
    fireEvent.click(screen.getByTestId("action-submit"));
    await waitFor(() => expect(screen.getByTestId("action-row-32")).toBeDefined());
    expect(createMock.mock.calls[1][0]).toBe(202);
    expect(createMock.mock.calls[1][2]).toBe(key202);
    expect(createMock.mock.calls[1][2]).not.toBe(createMock.mock.calls[0][2]);
  });

  it("ignores a stale list response when Ticket A resolves after Ticket B (stale-request race)", async () => {
    const actionA = actionFixture(901, {
      ticketId: 301,
      description: "Action from ticket A.",
      result: "Result A.",
    });
    const actionB = actionFixture(902, {
      ticketId: 302,
      description: "Action from ticket B.",
      result: "Result B.",
    });
    let resolveA!: (v: api.ActionsResponse) => void;
    let resolveB!: (v: api.ActionsResponse) => void;
    getActionsMock.mockImplementation((tid: number) => {
      if (tid === 301) return new Promise<api.ActionsResponse>((r) => (resolveA = r));
      if (tid === 302) return new Promise<api.ActionsResponse>((r) => (resolveB = r));
      return Promise.resolve(pageOf([], 0));
    });

    // Mount on Ticket A; its list request stays pending.
    const view = renderSection(301);
    await waitFor(() => expect(getActionsMock).toHaveBeenCalledWith(301, 1, 20));

    // Switch A -> B while A is still in flight; B's request starts too.
    view.rerender(
      <BrowserRouter>
        <AuthProvider>
          <ActionsTaken ticketId={302} />
        </AuthProvider>
      </BrowserRouter>
    );
    await waitFor(() => expect(getActionsMock).toHaveBeenCalledWith(302, 1, 20));

    // B (fast) resolves first, then A (slow) resolves late. The UI must keep
    // showing only B's actions — A's stale payload must be ignored.
    // NOTE: each action renders twice (desktop table + mobile card), so use
    // the *AllBy* queries.
    await act(async () => {
      resolveB(pageOf([actionB], 1));
    });
    await waitFor(() => expect(screen.getAllByText("Action from ticket B.").length).toBeGreaterThanOrEqual(1));

    await act(async () => {
      resolveA(pageOf([actionA], 1));
      // Flush the stale promise continuation so a buggy last-writer-wins
      // implementation would have replaced the list by now.
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getAllByText("Action from ticket B.").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText("Action from ticket A.")).toHaveLength(0);
    expect(screen.getByTestId("actions-heading").textContent).toMatch(/\(1\)/);
  });

  it("ignores a stale create response after switching tickets (no cross-ticket prepend)", async () => {
    getActionsMock.mockImplementation(async () => pageOf([], 0));
    let resolveCreate!: (v: api.ActionTaken) => void;
    createMock.mockImplementation(() => new Promise<api.ActionTaken>((r) => (resolveCreate = r)));
    const createdOnA = actionFixture(911, {
      ticketId: 301,
      description: "Created on ticket A.",
      result: "Result A.",
    });

    // Submit on Ticket A; the create stays pending.
    const view = renderSection(301);
    await waitFor(() => expect(screen.getByTestId("action-create-form")).toBeDefined());
    fireEvent.change(screen.getByTestId("action-description"), { target: { value: "Created on ticket A." } });
    fireEvent.change(screen.getByTestId("action-result"), { target: { value: "Result A." } });
    fireEvent.click(screen.getByTestId("action-submit"));
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));

    // Switch A -> B while the create is still in flight.
    view.rerender(
      <BrowserRouter>
        <AuthProvider>
          <ActionsTaken ticketId={302} />
        </AuthProvider>
      </BrowserRouter>
    );
    await waitFor(() => expect(screen.getByTestId("action-create-form")).toBeDefined());
    // B starts with a blank form (A's draft must not leak).
    expect((screen.getByTestId("action-description") as HTMLTextAreaElement).value).toBe("");

    // A's create resolves late: it must not prepend to B's list, must not
    // touch B's draft, but must clear A's own stored draft (server committed).
    await act(async () => {
      resolveCreate(createdOnA);
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.queryByTestId("action-row-911")).toBeNull();
    expect(screen.queryByTestId("actions-list")).toBeNull();
    expect((screen.getByTestId("action-description") as HTMLTextAreaElement).value).toBe("");
    expect(window.localStorage.getItem("l4-action-draft:301")).toBeNull();
  });

  it("ignores a stale Load more response after switching tickets", async () => {
    const first20 = Array.from({ length: 20 }, (_, i) => actionFixture(100 - i, { ticketId: 301 }));
    const last5 = Array.from({ length: 5 }, (_, i) => actionFixture(80 - i, { ticketId: 301 }));
    let resolvePage2!: (v: api.ActionsResponse) => void;
    getActionsMock.mockImplementation((tid: number, page: number) => {
      if (tid === 301 && page === 1) return Promise.resolve(pageOf(first20, 25, 1, 20));
      if (tid === 301) return new Promise<api.ActionsResponse>((r) => (resolvePage2 = r));
      return Promise.resolve(pageOf([], 0));
    });

    // Ticket A shows 20/25 with Load more; page 2 stays pending.
    const view = renderSection(301);
    await waitFor(() => expect(screen.getByTestId("actions-load-more")).toBeDefined());
    fireEvent.click(screen.getByTestId("actions-load-more"));
    await waitFor(() => expect(getActionsMock).toHaveBeenCalledWith(301, 2, 20));

    // Switch A -> B while page 2 is still in flight; B loads empty.
    view.rerender(
      <BrowserRouter>
        <AuthProvider>
          <ActionsTaken ticketId={302} />
        </AuthProvider>
      </BrowserRouter>
    );
    await waitFor(() => expect(screen.getByTestId("actions-empty")).toBeDefined());

    // A's page 2 resolves late: its rows must never appear under B.
    await act(async () => {
      resolvePage2(pageOf(last5, 25, 2, 20));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.queryByTestId("action-row-76")).toBeNull();
    expect(screen.getByTestId("actions-empty")).toBeDefined();
    expect(screen.queryByTestId("actions-load-more")).toBeNull();
  });
});
