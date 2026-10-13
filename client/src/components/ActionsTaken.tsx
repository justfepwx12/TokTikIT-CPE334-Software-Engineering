import { useCallback, useEffect, useRef, useState } from "react";
import {
  ACTION_TEXT_MAX,
  ACTION_FUTURE_SKEW_MS,
  createTicketAction,
  getTicketActions,
  isApiError,
  updateTicketAction,
  type ActionTaken,
} from "../api.js";
import { useAuth } from "../hooks/useAuth";
import Badge from "./Badge";
import Button from "./Button";
import ValidationMessage from "./ValidationMessage";

// Actions Taken section embedded in Ticket Detail (Lab 4 ui-spec §4, FR-33).
// Newest-first list + Staff/Admin-only Create/Edit; Requesters get a read-only
// list with zero create/edit affordances (AC-50). The server enforces every
// rule — this UI mirrors validation for instant feedback only (AC-51).

const PAGE_LIMIT = 20;

interface CreateDraft {
  actionAt: string;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
}

interface EditDraft {
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// datetime-local value in the viewer's timezone; defaults to now.
function toLocalInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultCreateDraft(): CreateDraft {
  return {
    actionAt: toLocalInputValue(new Date()),
    description: "",
    result: "",
    followUpRequired: false,
    followUpNote: "",
    attachmentNotes: "",
  };
}

function draftKey(ticketId: number): string {
  return `l4-action-draft:${ticketId}`;
}

function editKey(ticketId: number, actionId: number): string {
  return `l4-action-edit:${ticketId}:${actionId}`;
}

function readStored<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private-mode quota errors must never break the form.
  }
}

function clearStored(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

function isCreateDraft(value: unknown): value is CreateDraft {
  if (typeof value !== "object" || value === null) return false;
  const d = value as Record<string, unknown>;
  return (
    typeof d.actionAt === "string" &&
    typeof d.description === "string" &&
    typeof d.result === "string" &&
    typeof d.followUpRequired === "boolean" &&
    typeof d.followUpNote === "string" &&
    typeof d.attachmentNotes === "string"
  );
}

// The persisted create entry: the draft travels together with its
// Idempotency-Key so a retry after a reload/remount replays the same key
// instead of minting a fresh one (which would create a duplicate when the
// first response was lost after the server committed).
interface StoredCreateEntry {
  draft: CreateDraft;
  key: string;
}

function isStoredCreateEntry(value: unknown): value is StoredCreateEntry {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return isCreateDraft(e.draft) && typeof e.key === "string" && e.key.length > 0;
}

function readStoredCreateEntry(ticketId: number): StoredCreateEntry {
  const raw = readStored<unknown>(draftKey(ticketId));
  if (isStoredCreateEntry(raw)) return raw;
  // Legacy shape (draft-only, written before the key was persisted): adopt
  // the draft and mint its key once, so even old drafts retry idempotently.
  if (isCreateDraft(raw)) return { draft: raw, key: newIdempotencyKey() };
  return { draft: defaultCreateDraft(), key: newIdempotencyKey() };
}

function newIdempotencyKey(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Fall through to the counter fallback below.
  }
  return `l4-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

type FieldErrors = Record<string, string>;

function validateCreate(d: CreateDraft): FieldErrors {
  const errors: FieldErrors = {};
  if (!d.actionAt) {
    errors.actionAt = "Action date and time is required.";
  } else {
    const ms = Date.parse(d.actionAt);
    if (Number.isNaN(ms)) {
      errors.actionAt = "Enter a valid date and time.";
    } else if (ms > Date.now() + ACTION_FUTURE_SKEW_MS) {
      errors.actionAt = "Action date must not be in the future.";
    }
  }
  if (d.description.trim().length < 1 || d.description.trim().length > ACTION_TEXT_MAX) {
    errors.description = `Description must be 1–${ACTION_TEXT_MAX} characters after trim.`;
  }
  if (d.result.trim().length < 1 || d.result.trim().length > ACTION_TEXT_MAX) {
    errors.result = `Result must be 1–${ACTION_TEXT_MAX} characters after trim.`;
  }
  if (d.followUpRequired) {
    if (d.followUpNote.trim().length < 1 || d.followUpNote.trim().length > ACTION_TEXT_MAX) {
      errors.followUpNote = `Follow-up note is required (1–${ACTION_TEXT_MAX} characters after trim) when follow-up is required.`;
    }
  }
  if (d.attachmentNotes.length > ACTION_TEXT_MAX) {
    errors.attachmentNotes = `Attachment notes must be at most ${ACTION_TEXT_MAX} characters.`;
  }
  return errors;
}

function validateEdit(d: EditDraft): FieldErrors {
  return validateCreate({
    actionAt: new Date().toISOString(),
    description: d.description,
    result: d.result,
    followUpRequired: d.followUpRequired,
    followUpNote: d.followUpNote,
    attachmentNotes: d.attachmentNotes,
  });
}

function formatLocal(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function roleBadgeColor(role: string): "green" | "blue" | "yellow" | "gray" {
  if (role === "IT_STAFF") return "blue";
  if (role === "ADMIN") return "yellow";
  if (role === "REQUESTER") return "green";
  return "gray";
}

// Focus the first visible heading for an action row (desktop table and mobile
// cards both render — pick the one the viewport actually shows).
function focusActionRow(actionId: number): void {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-action-title="${actionId}"]`));
  const visible = nodes.find((n) => n.offsetParent !== null) ?? nodes[0];
  visible?.focus();
}

function FollowUpCell({ action }: { action: ActionTaken }) {
  if (!action.followUpRequired) {
    return (
      <span className="text-secondary" aria-label="No follow-up">
        —
      </span>
    );
  }
  return (
    <div>
      <Badge color="yellow">Follow-Up</Badge>
      {action.followUpNote && <div className="small text-dark mt-1">{action.followUpNote}</div>}
    </div>
  );
}

export default function ActionsTaken({ ticketId }: { ticketId: number }) {
  const { user } = useAuth();
  const canWrite = user?.role === "IT_STAFF" || user?.role === "ADMIN";

  const [actions, setActions] = useState<ActionTaken[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [storedEntry] = useState<StoredCreateEntry>(() => readStoredCreateEntry(ticketId));
  const [createDraft, setCreateDraft] = useState<CreateDraft>(storedEntry.draft);
  const [createErrors, setCreateErrors] = useState<FieldErrors>({});
  const [createServerError, setCreateServerError] = useState<string | null>(null);
  const [createReuseError, setCreateReuseError] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const idempotencyKeyRef = useRef<string>(storedEntry.key);
  const createHeadingRef = useRef<HTMLHeadingElement>(null);

  const [editing, setEditing] = useState<ActionTaken | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [editServerError, setEditServerError] = useState<string | null>(null);
  const [editConflict, setEditConflict] = useState<{ currentVersion: number } | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editHeadingRef = useRef<HTMLHeadingElement>(null);

  // Draft AND its idempotency key survive failed loads, errors, and even a
  // page reload/remount — both persist until success or explicit Discard, so
  // a retried draft always replays the same key (no duplicate on retry).
  useEffect(() => {
    writeStored(draftKey(ticketId), { draft: createDraft, key: idempotencyKeyRef.current } satisfies StoredCreateEntry);
  }, [createDraft, ticketId]);

  useEffect(() => {
    if (editing && editDraft) writeStored(editKey(ticketId, editing.id), editDraft);
  }, [editing, editDraft, ticketId]);

  const loadFirst = useCallback(async () => {
    setIsLoading(true);
    setListError(null);
    try {
      const res = await getTicketActions(ticketId, 1, PAGE_LIMIT);
      setActions(res.actions);
      setTotal(res.pagination.total);
      setPage(1);
    } catch (err) {
      setActions([]);
      setListError(err instanceof Error ? err.message : "Failed to load actions.");
    } finally {
      setIsLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await loadFirst();
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loadFirst, retryKey]);

  const handleLoadMore = async () => {
    if (isLoadingMore || actions.length >= total) return;
    setIsLoadingMore(true);
    try {
      const res = await getTicketActions(ticketId, page + 1, PAGE_LIMIT);
      setActions((prev) => [...prev, ...res.actions]);
      setTotal(res.pagination.total);
      setPage((p) => p + 1);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to load more actions.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const patchCreate = (patch: Partial<CreateDraft>) => {
    setCreateDraft((prev) => ({ ...prev, ...patch }));
    setCreateServerError(null);
    setCreateReuseError(false);
  };

  const handleDiscardCreate = () => {
    setCreateDraft(defaultCreateDraft());
    setCreateErrors({});
    setCreateServerError(null);
    setCreateReuseError(false);
    clearStored(draftKey(ticketId));
    idempotencyKeyRef.current = newIdempotencyKey();
    createHeadingRef.current?.focus();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;
    const errors = validateCreate(createDraft);
    setCreateErrors(errors);
    if (Object.keys(errors).length > 0) {
      const first = ["actionAt", "description", "result", "followUpNote", "attachmentNotes"].find((f) => errors[f]);
      document.getElementById(first === "followUpNote" ? "action-followup-note" : `action-${first}`)?.focus();
      return;
    }
    setIsCreating(true);
    setCreateServerError(null);
    setCreateReuseError(false);
    try {
      const created = await createTicketAction(
        ticketId,
        {
          actionAt: new Date(createDraft.actionAt).toISOString(),
          description: createDraft.description.trim(),
          result: createDraft.result.trim(),
          followUpRequired: createDraft.followUpRequired,
          ...(createDraft.followUpRequired ? { followUpNote: createDraft.followUpNote.trim() } : {}),
          ...(createDraft.attachmentNotes ? { attachmentNotes: createDraft.attachmentNotes } : {}),
        },
        idempotencyKeyRef.current
      );
      // Newest-first: the record leads the list.
      setActions((prev) => [created, ...prev]);
      setTotal((t) => t + 1);
      setCreateDraft(defaultCreateDraft());
      setCreateErrors({});
      clearStored(draftKey(ticketId));
      idempotencyKeyRef.current = newIdempotencyKey();
      requestAnimationFrame(() => focusActionRow(created.id));
    } catch (err) {
      if (isApiError(err) && err.status === 422) {
        setCreateReuseError(true);
        setCreateServerError("This form was already submitted with different content. Discard to start fresh, or reload the list.");
      } else {
        // Draft is preserved for retry (AC-52).
        setCreateServerError(err instanceof Error ? err.message : "Could not save the action.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const openEdit = (action: ActionTaken) => {
    const stored = readStored<EditDraft>(editKey(ticketId, action.id));
    const base: EditDraft = {
      description: action.description,
      result: action.result,
      followUpRequired: action.followUpRequired,
      followUpNote: action.followUpNote ?? "",
      attachmentNotes: action.attachmentNotes ?? "",
    };
    setEditing(action);
    setEditDraft(stored && typeof stored.description === "string" ? stored : base);
    setEditErrors({});
    setEditServerError(null);
    setEditConflict(null);
    requestAnimationFrame(() => editHeadingRef.current?.focus());
  };

  const closeEdit = () => {
    if (editing) clearStored(editKey(ticketId, editing.id));
    setEditing(null);
    setEditDraft(null);
    setEditErrors({});
    setEditServerError(null);
    setEditConflict(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editDraft || isSavingEdit) return;
    const errors = validateEdit(editDraft);
    setEditErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setIsSavingEdit(true);
    setEditServerError(null);
    try {
      const updated = await updateTicketAction(
        editing.id,
        {
          description: editDraft.description.trim(),
          result: editDraft.result.trim(),
          followUpRequired: editDraft.followUpRequired,
          ...(editDraft.followUpRequired ? { followUpNote: editDraft.followUpNote.trim() } : {}),
          attachmentNotes: editDraft.attachmentNotes,
        },
        editing.version
      );
      setActions((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      clearStored(editKey(ticketId, editing.id));
      const updatedId = updated.id;
      setEditing(null);
      setEditDraft(null);
      setEditConflict(null);
      requestAnimationFrame(() => focusActionRow(updatedId));
    } catch (err) {
      if (isApiError(err) && err.status === 409) {
        // Stale write: the stored row is untouched; the client must re-fetch
        // and retry (api-spec §1). Draft is preserved for retry after refresh.
        setEditConflict({ currentVersion: err.currentVersion ?? editing.version + 1 });
      } else {
        setEditServerError(err instanceof Error ? err.message : "Could not save the action.");
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleRefreshEdit = async () => {
    if (!editing) return;
    try {
      // Re-read everything loaded so far so the edited row is found wherever
      // it sits in newest-first order; pagination position is preserved.
      const res = await getTicketActions(ticketId, 1, Math.max(actions.length, PAGE_LIMIT));
      setActions(res.actions);
      setTotal(res.pagination.total);
      const fresh = res.actions.find((a) => a.id === editing.id);
      if (!fresh) {
        setEditServerError("Could not reload the latest version. Retry.");
        return;
      }
      setEditing(fresh);
      setEditDraft({
        description: fresh.description,
        result: fresh.result,
        followUpRequired: fresh.followUpRequired,
        followUpNote: fresh.followUpNote ?? "",
        attachmentNotes: fresh.attachmentNotes ?? "",
      });
      setEditErrors({});
      setEditConflict(null);
      setEditServerError(null);
      requestAnimationFrame(() => editHeadingRef.current?.focus());
    } catch (err) {
      setEditServerError(err instanceof Error ? err.message : "Could not reload the latest version.");
    }
  };

  return (
    <section className="card shadow-sm border-0 rounded-3 p-3 mb-3" aria-label="Actions taken" data-testid="actions-taken">
      <h3 className="h6 fw-bold text-dark mb-1" data-testid="actions-heading">
        Actions Taken{total > 0 ? ` (${total})` : ""}
      </h3>
      <p className="text-secondary small mb-3">Structured work log. Newest first.</p>

      {isLoading && (
        <div data-testid="actions-loading" className="text-secondary small py-3 text-center">
          Loading actions…
        </div>
      )}

      {!isLoading && listError && actions.length === 0 && (
        <div data-testid="actions-error" role="alert" className="alert alert-danger d-flex justify-content-between align-items-center py-2">
          <span className="small">{listError}</span>
          <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !listError && actions.length === 0 && (
        <div data-testid="actions-empty" className="text-secondary small py-2">
          <p className="mb-1">No actions recorded yet.</p>
          {canWrite ? (
            <p className="mb-0">Use the form below to record the first action.</p>
          ) : (
            <p className="mb-0">Actions recorded by the IT team will appear here.</p>
          )}
        </div>
      )}

      {actions.length > 0 && (
        <>
          <div className="d-none d-md-block overflow-auto" data-testid="actions-table-wrap">
            <table className="table table-hover align-middle mb-0" data-testid="actions-list">
              <thead className="table-light">
                <tr>
                  <th scope="col">Date / Time</th>
                  <th scope="col">Description</th>
                  <th scope="col">Result</th>
                  <th scope="col">Performed By</th>
                  <th scope="col">Follow-Up</th>
                  <th scope="col">Attachment Notes</th>
                  {canWrite && <th scope="col"><span className="visually-hidden">Row actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.id} data-testid={`action-row-${a.id}`}>
                    <td className="small text-nowrap" title={a.actionAt}>{formatLocal(a.actionAt)}</td>
                    <td>
                      <div className="fw-semibold text-dark" data-action-title={a.id} tabIndex={-1} data-testid={`action-title-${a.id}`}>
                        {a.description}
                      </div>
                    </td>
                    <td className="small">{a.result}</td>
                    <td className="small text-nowrap">
                      {a.performedBy.name} <Badge color={roleBadgeColor(a.performedBy.role)}>{a.performedBy.role}</Badge>
                    </td>
                    <td className="small"><FollowUpCell action={a} /></td>
                    <td className="small text-secondary">
                      {a.attachmentNotes ? (
                        <span title={a.attachmentNotes} tabIndex={0} className="d-inline-block text-truncate" style={{ maxWidth: "180px" }}>
                          {a.attachmentNotes}
                        </span>
                      ) : (
                        <span aria-label="No attachment notes">—</span>
                      )}
                    </td>
                    {canWrite && (
                      <td>
                        <button type="button" className="btn btn-sm btn-outline-secondary" data-testid={`action-edit-${a.id}`} onClick={() => openEdit(a)}>
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="d-md-none d-flex flex-column gap-2" data-testid="actions-cards">
            {actions.map((a) => (
              <article key={a.id} className="border rounded-3 p-3" data-testid={`action-card-${a.id}`}>
                <h4 className="h6 fw-bold text-dark mb-1" data-action-title={a.id} tabIndex={-1} data-testid={`action-card-title-${a.id}`}>
                  {a.description}
                </h4>
                <div className="small text-secondary mb-1" title={a.actionAt}>{formatLocal(a.actionAt)}</div>
                <div className="small mb-1">Result: <span className="text-dark">{a.result}</span></div>
                <div className="small mb-1">
                  {a.performedBy.name} <Badge color={roleBadgeColor(a.performedBy.role)}>{a.performedBy.role}</Badge>
                </div>
                <div className="small mb-1"><FollowUpCell action={a} /></div>
                {a.attachmentNotes && <div className="small text-secondary">Notes: {a.attachmentNotes}</div>}
                {canWrite && (
                  <button type="button" className="btn btn-sm btn-outline-secondary mt-2" data-testid={`action-card-edit-${a.id}`} onClick={() => openEdit(a)}>
                    Edit
                  </button>
                )}
              </article>
            ))}
          </div>

          {listError && (
            <div data-testid="actions-more-error" role="alert" className="alert alert-danger py-2 small mt-2">
              {listError}
            </div>
          )}

          {actions.length < total && (
            <div className="text-center mt-3">
              <Button variant="secondary" onClick={() => void handleLoadMore()} disabled={isLoadingMore} data-testid="actions-load-more">
                {isLoadingMore ? "Loading…" : `Load more (${total - actions.length} remaining)`}
              </Button>
            </div>
          )}
        </>
      )}

      {editing && editDraft && canWrite && (
        <form onSubmit={(e) => void handleSaveEdit(e)} data-testid="action-edit-form" className="border rounded-3 p-3 mt-3" noValidate>
          <h4 ref={editHeadingRef} tabIndex={-1} className="h6 fw-bold text-dark mb-3" data-testid="action-edit-heading">
            Edit action
          </h4>
          {editConflict && (
            <div data-testid="action-conflict" role="alert" className="alert alert-warning d-flex flex-wrap justify-content-between align-items-center gap-2 py-2">
              <span className="small">Someone updated this action — Refresh to load the latest, then retry.</span>
              <Button variant="secondary" type="button" data-testid="action-conflict-refresh" onClick={() => void handleRefreshEdit()}>
                Refresh
              </Button>
            </div>
          )}
          {editServerError && (
            <div data-testid="action-edit-server-error" role="alert" className="alert alert-danger py-2 small">
              {editServerError}
            </div>
          )}
          <div className="mb-3">
            <label className="form-label small fw-bold" htmlFor="action-edit-description">
              Description
            </label>
            <textarea
              id="action-edit-description"
              data-testid="action-edit-description"
              className="form-control"
              rows={3}
              maxLength={ACTION_TEXT_MAX}
              value={editDraft.description}
              onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
              aria-invalid={editErrors.description ? "true" : "false"}
            />
            <div className="form-text small" data-testid="action-edit-description-count">{editDraft.description.length}/{ACTION_TEXT_MAX}</div>
            {editErrors.description && <ValidationMessage>{editErrors.description}</ValidationMessage>}
          </div>
          <div className="mb-3">
            <label className="form-label small fw-bold" htmlFor="action-edit-result">
              Result
            </label>
            <textarea
              id="action-edit-result"
              data-testid="action-edit-result"
              className="form-control"
              rows={3}
              maxLength={ACTION_TEXT_MAX}
              value={editDraft.result}
              onChange={(e) => setEditDraft({ ...editDraft, result: e.target.value })}
              aria-invalid={editErrors.result ? "true" : "false"}
            />
            <div className="form-text small" data-testid="action-edit-result-count">{editDraft.result.length}/{ACTION_TEXT_MAX}</div>
            {editErrors.result && <ValidationMessage>{editErrors.result}</ValidationMessage>}
          </div>
          <div className="form-check mb-3">
            <input
              id="action-edit-followup"
              data-testid="action-edit-followup"
              className="form-check-input"
              type="checkbox"
              checked={editDraft.followUpRequired}
              onChange={(e) => setEditDraft({ ...editDraft, followUpRequired: e.target.checked })}
            />
            <label className="form-check-label small fw-bold" htmlFor="action-edit-followup">
              Follow-up required
            </label>
          </div>
          {editDraft.followUpRequired && (
            <div className="mb-3">
              <label className="form-label small fw-bold" htmlFor="action-edit-followup-note">
                Follow-up note
              </label>
              <textarea
                id="action-edit-followup-note"
                data-testid="action-edit-followup-note"
                className="form-control"
                rows={2}
                maxLength={ACTION_TEXT_MAX}
                value={editDraft.followUpNote}
                onChange={(e) => setEditDraft({ ...editDraft, followUpNote: e.target.value })}
                aria-invalid={editErrors.followUpNote ? "true" : "false"}
              />
              {editErrors.followUpNote && <ValidationMessage>{editErrors.followUpNote}</ValidationMessage>}
            </div>
          )}
          <div className="mb-3">
            <label className="form-label small fw-bold" htmlFor="action-edit-attachment">
              Attachment notes <span className="fw-normal text-secondary">(optional)</span>
            </label>
            <input
              id="action-edit-attachment"
              data-testid="action-edit-attachment"
              className="form-control"
              type="text"
              maxLength={ACTION_TEXT_MAX}
              value={editDraft.attachmentNotes}
              onChange={(e) => setEditDraft({ ...editDraft, attachmentNotes: e.target.value })}
              placeholder="Filenames, locations…"
            />
            {editErrors.attachmentNotes && <ValidationMessage>{editErrors.attachmentNotes}</ValidationMessage>}
          </div>
          <div className="d-flex gap-2">
            <Button type="submit" disabled={isSavingEdit} isLoading={isSavingEdit} loadingText="Saving…" data-testid="action-edit-submit">
              Save changes
            </Button>
            <Button type="button" variant="secondary" onClick={closeEdit} disabled={isSavingEdit} data-testid="action-edit-cancel">
              Cancel
            </Button>
          </div>
        </form>
      )}

      {canWrite && (
        <form onSubmit={(e) => void handleCreate(e)} data-testid="action-create-form" className="border rounded-3 p-3 mt-3" noValidate>
          <h4 ref={createHeadingRef} tabIndex={-1} className="h6 fw-bold text-dark mb-1" data-testid="action-create-heading">
            Record an action
          </h4>
          {user && (
            <p className="small text-secondary mb-3" data-testid="action-recording-as">
              Recording as <strong>{user.name}</strong>
            </p>
          )}
          {createServerError && (
            <div data-testid="action-server-error" role="alert" className={`alert py-2 small ${createReuseError ? "alert-warning" : "alert-danger"}`}>
              {createServerError}
            </div>
          )}
          <div className="mb-3">
            <label className="form-label small fw-bold" htmlFor="action-actionAt">
              Action date and time
            </label>
            <input
              id="action-actionAt"
              data-testid="action-actionAt"
              className="form-control"
              type="datetime-local"
              value={createDraft.actionAt}
              onChange={(e) => patchCreate({ actionAt: e.target.value })}
              aria-invalid={createErrors.actionAt ? "true" : "false"}
            />
            {createErrors.actionAt && <ValidationMessage>{createErrors.actionAt}</ValidationMessage>}
          </div>
          <div className="mb-3">
            <label className="form-label small fw-bold" htmlFor="action-description">
              Description
            </label>
            <textarea
              id="action-description"
              data-testid="action-description"
              className="form-control"
              rows={3}
              maxLength={ACTION_TEXT_MAX}
              value={createDraft.description}
              onChange={(e) => patchCreate({ description: e.target.value })}
              placeholder="What was done…"
              aria-invalid={createErrors.description ? "true" : "false"}
            />
            <div className="form-text small" data-testid="action-description-count">{createDraft.description.length}/{ACTION_TEXT_MAX}</div>
            {createErrors.description && <ValidationMessage>{createErrors.description}</ValidationMessage>}
          </div>
          <div className="mb-3">
            <label className="form-label small fw-bold" htmlFor="action-result">
              Result
            </label>
            <textarea
              id="action-result"
              data-testid="action-result"
              className="form-control"
              rows={3}
              maxLength={ACTION_TEXT_MAX}
              value={createDraft.result}
              onChange={(e) => patchCreate({ result: e.target.value })}
              placeholder="What resulted…"
              aria-invalid={createErrors.result ? "true" : "false"}
            />
            <div className="form-text small" data-testid="action-result-count">{createDraft.result.length}/{ACTION_TEXT_MAX}</div>
            {createErrors.result && <ValidationMessage>{createErrors.result}</ValidationMessage>}
          </div>
          <div className="form-check mb-3">
            <input
              id="action-followup"
              data-testid="action-followup"
              className="form-check-input"
              type="checkbox"
              checked={createDraft.followUpRequired}
              onChange={(e) => patchCreate({ followUpRequired: e.target.checked })}
            />
            <label className="form-check-label small fw-bold" htmlFor="action-followup">
              Follow-up required
            </label>
          </div>
          {createDraft.followUpRequired && (
            <div className="mb-3">
              <label className="form-label small fw-bold" htmlFor="action-followup-note">
                Follow-up note
              </label>
              <textarea
                id="action-followup-note"
                data-testid="action-followup-note"
                className="form-control"
                rows={2}
                maxLength={ACTION_TEXT_MAX}
                value={createDraft.followUpNote}
                onChange={(e) => patchCreate({ followUpNote: e.target.value })}
                aria-invalid={createErrors.followUpNote ? "true" : "false"}
              />
              {createErrors.followUpNote && <ValidationMessage>{createErrors.followUpNote}</ValidationMessage>}
            </div>
          )}
          <div className="mb-3">
            <label className="form-label small fw-bold" htmlFor="action-attachment">
              Attachment notes <span className="fw-normal text-secondary">(optional)</span>
            </label>
            <input
              id="action-attachment"
              data-testid="action-attachment"
              className="form-control"
              type="text"
              maxLength={ACTION_TEXT_MAX}
              value={createDraft.attachmentNotes}
              onChange={(e) => patchCreate({ attachmentNotes: e.target.value })}
              placeholder="Filenames, locations…"
            />
            {createErrors.attachmentNotes && <ValidationMessage>{createErrors.attachmentNotes}</ValidationMessage>}
          </div>
          <div className="d-flex gap-2">
            <Button type="submit" disabled={isCreating} isLoading={isCreating} loadingText="Saving…" data-testid="action-submit">
              Save action
            </Button>
            <Button type="button" variant="secondary" onClick={handleDiscardCreate} disabled={isCreating} data-testid="action-discard">
              Discard
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
