import { useState, useEffect } from "react";
import {
  getComments,
  postComment,
  COMMENT_BODY_MIN,
  COMMENT_BODY_MAX,
  type TicketComment,
} from "../api.js";
import CommentTimeline from "./CommentTimeline";
import Button from "./Button";

// Public Comments section for the requester ticket detail (ui-spec §7,
// BR-17): full read (newest-first) + append-only composer. Internal Notes
// are never fetched or rendered here (BR-18).
export default function PublicComments({ ticketId }: { ticketId: number }) {
  const [comments, setComments] = useState<TicketComment[]>([]);
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
        const res = await getComments(ticketId);
        if (cancelled) return;
        setComments(res.comments);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load comments.");
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
        `Comment must be between ${COMMENT_BODY_MIN} and ${COMMENT_BODY_MAX} characters.`
      );
      return;
    }
    setIsPosting(true);
    setFieldError(null);
    try {
      const created = await postComment(ticketId, trimmed);
      setComments((prev) => [created, ...prev]);
      setDraft("");
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : "Could not post the comment.");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <section
      className="card shadow-sm border-0 rounded-3 p-3 mb-3"
      aria-label="Public comments"
      data-testid="public-comments"
    >
      <h3 className="h6 fw-bold text-dark mb-1">Public Comments</h3>
      <p className="text-secondary small mb-3">Shared with the IT team. Newest first.</p>

      {isLoading && (
        <div data-testid="comments-loading" className="text-secondary small py-3 text-center">
          Loading comments…
        </div>
      )}

      {!isLoading && error && (
        <div
          data-testid="comments-error"
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
        <div data-testid="comments-list" className="mb-3">
          <CommentTimeline entries={comments} />
        </div>
      )}

      <label className="form-label small fw-bold" htmlFor="comment-composer">
        Append a public comment
      </label>
      <textarea
        id="comment-composer"
        data-testid="comment-composer"
        className="form-control mb-2"
        rows={3}
        maxLength={COMMENT_BODY_MAX}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Write an update or answer for the IT team…"
        aria-invalid={fieldError ? "true" : "false"}
        aria-describedby={fieldError ? "comment-error" : undefined}
      />
      {fieldError && (
        <div data-testid="comment-error" role="alert" className="text-danger small mb-2">
          {fieldError}
        </div>
      )}
      <Button
        type="button"
        onClick={() => void handlePost()}
        disabled={isPosting}
        data-testid="comment-submit"
      >
        {isPosting ? "Posting…" : "Post public comment"}
      </Button>
    </section>
  );
}
