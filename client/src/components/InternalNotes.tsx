import { useState, useEffect } from "react";
import { Lock } from "lucide-react";
import {
  getNotes,
  postNote,
  COMMENT_BODY_MIN,
  COMMENT_BODY_MAX,
  type InternalNote,
} from "../api.js";
import CommentTimeline from "./CommentTimeline";
import Button from "./Button";

// Internal Notes section (ui-spec §6, BR-21): staff-only operational notes.
// Visually distinct — pale-yellow surface (#FFFBEB), amber border and a lock
// indicator with an "Internal — IT Staff only" label — so a note is never
// mistaken for a public comment. Built and tested here; mounted in the staff
// ticket detail once that screen lands (Issue 5/6 stack).
export default function InternalNotes({ ticketId }: { ticketId: number }) {
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getNotes(ticketId);
        if (cancelled) return;
        setNotes(res.notes);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load internal notes.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [ticketId, retryKey]);

  const handlePost = async () => {
    const trimmed = draft.trim();
    if (trimmed.length < COMMENT_BODY_MIN || trimmed.length > COMMENT_BODY_MAX) {
      setFieldError(
        `Note must be between ${COMMENT_BODY_MIN} and ${COMMENT_BODY_MAX} characters.`
      );
      return;
    }
    setIsPosting(true);
    setFieldError(null);
    try {
      const created = await postNote(ticketId, trimmed);
      setNotes((prev) => [created, ...prev]);
      setDraft("");
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : "Could not post the note.");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <section
      className="card shadow-sm rounded-3 p-3 mb-3"
      style={{ backgroundColor: "#FFFBEB", borderColor: "#FBBF24" }}
      aria-label="Internal notes"
      data-testid="internal-notes"
    >
      <h3 className="h6 fw-bold text-dark mb-1 d-flex align-items-center gap-2">
        <Lock size={16} aria-hidden="true" />
        Internal Notes
        <span className="badge text-dark border" style={{ backgroundColor: "#FEF3C7" }}>
          Internal — IT Staff only
        </span>
      </h3>
      <p className="text-secondary small mb-3">Never visible to the requester. Newest first.</p>

      {isLoading && (
        <div data-testid="notes-loading" className="text-secondary small py-3 text-center">
          Loading internal notes…
        </div>
      )}

      {!isLoading && error && (
        <div
          data-testid="notes-error"
          role="alert"
          className="alert alert-danger d-flex justify-content-between align-items-center py-2"
        >
          <span className="small">{error}</span>
          <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !error && (
        <div data-testid="notes-list" className="mb-3">
          <CommentTimeline entries={notes} />
        </div>
      )}

      <label className="form-label small fw-bold" htmlFor="note-composer">
        Append an internal note
      </label>
      <textarea
        id="note-composer"
        data-testid="note-composer"
        className="form-control mb-2"
        rows={3}
        maxLength={COMMENT_BODY_MAX}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Append an operational note for IT staff…"
        aria-invalid={fieldError ? "true" : "false"}
        aria-describedby={fieldError ? "note-error" : undefined}
      />
      {fieldError && (
        <div data-testid="note-error" role="alert" className="text-danger small mb-2">
          {fieldError}
        </div>
      )}
      <Button
        type="button"
        onClick={() => void handlePost()}
        disabled={isPosting}
        data-testid="note-submit"
      >
        {isPosting ? "Posting…" : "Post internal note"}
      </Button>
    </section>
  );
}
