import { useEffect, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, FileText, File, Download, X } from "lucide-react";
import {
  getTicket,
  downloadAttachment,
  removeAttachment,
  triggerDownload,
  type TicketStatus,
  type TicketPriority,
  type TicketDetail as TicketDetailType,
  type TicketDetailAttachment,
} from "../api";
import { useRequester } from "../hooks/useRequester";
import Badge from "../components/Badge";
import Button from "../components/Button";
import ValidationMessage from "../components/ValidationMessage";

const REMOVAL_REASON_MIN = 3;
const REMOVAL_REASON_MAX = 200;

const STATUS_COLOR: Record<TicketStatus, "gray" | "blue" | "green"> = {
  NEW: "gray",
  OPEN: "blue",
  IN_PROGRESS: "blue",
  WAITING_FOR_REQUESTER: "gray",
  RESOLVED: "green",
  CLOSED: "gray",
  REOPENED: "blue",
  CANCELLED: "gray",
};

const PRIORITY_COLOR: Record<TicketPriority, "gray" | "yellow" | "red"> = {
  LOW: "gray",
  MEDIUM: "yellow",
  HIGH: "red",
  URGENT: "red",
};

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPreviewableMime(mime: string): boolean {
  return mime.startsWith("image/") || mime === "application/pdf";
}

function ReadOnlyField({
  label,
  value,
  dataTestid,
}: {
  label: string;
  value: string;
  dataTestid?: string;
}) {
  return (
    <div className="mb-3">
      <label className="form-label fw-bold small text-dark mb-1">{label}</label>
      <div
        className="form-control p-3 text-dark"
        style={{ backgroundColor: "#F1F0E9" }}
        data-testid={dataTestid}
      >
        {value}
      </div>
    </div>
  );
}

function AttachmentRow({
  attachment,
  onDownload,
  onRemove,
}: {
  attachment: TicketDetailAttachment;
  onDownload: (attachmentId: number) => void;
  onRemove: (attachment: TicketDetailAttachment) => void;
}) {
  const Icon = isPreviewableMime(attachment.mimeType) ? FileText : File;

  return (
    <li
      className="list-group-item d-flex align-items-center gap-3 py-3"
      data-testid={`attachment-row-${attachment.id}`}
    >
      <Icon size={20} className="text-secondary flex-shrink-0" />
      <div className="flex-grow-1 min-w-0">
        <div className="fw-semibold text-dark text-truncate">{attachment.filename}</div>
        <div className="text-secondary small">{formatSize(attachment.size)}</div>
      </div>
      <span className="small text-secondary text-nowrap">{attachment.mimeType}</span>
      {attachment.isRemoved ? (
        <span
          className="badge text-bg-secondary"
          data-testid={`removed-badge-${attachment.id}`}
        >
          Removed
        </span>
      ) : (
        <div className="d-flex gap-2 align-items-center">
          <button
            type="button"
            data-testid={`download-${attachment.id}`}
            className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
            onClick={() => onDownload(attachment.id)}
          >
            <Download size={16} aria-hidden="true" />
            Download
          </button>
          <button
            type="button"
            data-testid={`remove-${attachment.id}`}
            aria-label={`Remove ${attachment.filename}`}
            className="btn btn-sm btn-outline-danger d-inline-flex align-items-center"
            onClick={() => onRemove(attachment)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </li>
  );
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { requester } = useRequester();

  const [ticket, setTicket] = useState<TicketDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [removalTarget, setRemovalTarget] = useState<TicketDetailAttachment | null>(null);
  const [removalReason, setRemovalReason] = useState("");
  const [removalError, setRemovalError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const removalModalRef = useRef<HTMLDivElement>(null);

  const isModalOpen = removalTarget !== null;

  const requesterId = requester?.id;
  const ticketId = Number(id);
  const idIsInvalid = !Number.isSafeInteger(ticketId) || ticketId <= 0;

  const closeRemoveModal = useCallback(() => {
    if (isRemoving) return;
    setRemovalTarget(null);
    setRemovalReason("");
    setRemovalError(null);
    setIsRemoving(false);
  }, [isRemoving]);

  useEffect(() => {
    if (!removalTarget) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeRemoveModal();
        return;
      }
      if (event.key === "Tab" && removalModalRef.current) {
        const focusables = removalModalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], textarea, input, select:not([disabled])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [removalTarget, isRemoving, closeRemoveModal]);

  useEffect(() => {
    if (idIsInvalid || requesterId === undefined) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getTicket(ticketId, requesterId);
        if (cancelled) return;
        setTicket(data);
      } catch (err) {
        if (cancelled) return;
        setTicket(null);
        setError(err instanceof Error ? err.message : "Failed to load ticket.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id, requesterId, retryKey, ticketId, idIsInvalid]);

  const handleDownload = async (attachmentId: number) => {
    if (requesterId === undefined) return;
    setDownloadError(null);
    try {
      const { blob, filename } = await downloadAttachment(attachmentId, requesterId);
      triggerDownload(blob, filename);
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : "Failed to download attachment."
      );
    }
  };

  const openRemoveModal = (attachment: TicketDetailAttachment) => {
    setRemovalTarget(attachment);
    setRemovalReason("");
    setRemovalError(null);
    setIsRemoving(false);
  };

  const handleConfirmRemove = async () => {
    if (!removalTarget || requesterId === undefined || isRemoving) return;

    const reason = removalReason.trim();
    if (reason.length < REMOVAL_REASON_MIN || reason.length > REMOVAL_REASON_MAX) {
      setRemovalError(
        `Reason must be between ${REMOVAL_REASON_MIN} and ${REMOVAL_REASON_MAX} characters.`
      );
      return;
    }

    setIsRemoving(true);
    setRemovalError(null);
    try {
      await removeAttachment(removalTarget.id, reason, requesterId);
      const removedId = removalTarget.id;
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              attachments: prev.attachments.map((a) =>
                a.id === removedId ? { ...a, isRemoved: true } : a
              ),
            }
          : prev
      );
      setRemovalTarget(null);
      setRemovalReason("");
      setIsRemoving(false);
    } catch (err) {
      setRemovalError(err instanceof Error ? err.message : "Failed to remove attachment.");
      setIsRemoving(false);
    }
  };

  if (idIsInvalid) {
    return (
      <div className="container py-5" style={{ maxWidth: "820px" }}>
        <div data-testid="ticket-detail-error" role="alert" className="alert alert-danger py-3">
          Invalid ticket id.
        </div>
        <Link to="/my-tickets" className="btn btn-link px-0 text-decoration-none">
          <ArrowLeft size={16} className="me-1" />
          Back to My Tickets
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container py-5 text-center" style={{ maxWidth: "820px" }}>
        <div className="text-secondary">Loading ticket...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-5" style={{ maxWidth: "820px" }}>
        <div data-testid="ticket-detail-error" role="alert" className="alert alert-danger d-flex justify-content-between align-items-center py-3">
          <span>{error}</span>
          <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)} data-testid="ticket-detail-retry">
            Retry
          </Button>
        </div>
        <Link to="/my-tickets" className="btn btn-link px-0 text-decoration-none">
          <ArrowLeft size={16} className="me-1" />
          Back to My Tickets
        </Link>
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div className="container py-4" style={{ maxWidth: "820px" }}>
      <Link to="/my-tickets" className="d-inline-flex align-items-center text-decoration-none text-secondary mb-3">
        <ArrowLeft size={16} className="me-1" />
        Back to My Tickets
      </Link>

      <div className="card shadow-sm border-0 rounded-3 bg-white" data-testid="ticket-detail">
        <div className="card-body p-4 p-md-5">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4">
            <div>
              <h2 className="h4 fw-bold text-dark mb-1" data-testid="ticket-title">
                {ticket.title}
              </h2>
              <div className="text-secondary">
                <span data-testid="ticket-ticket-no">{ticket.ticketNo}</span>
              </div>
            </div>
            <div className="d-flex gap-2">
              <Badge color={PRIORITY_COLOR[ticket.requestedPriority]} data-testid="ticket-priority">
                {ticket.requestedPriority}
              </Badge>
              <Badge color={STATUS_COLOR[ticket.status]}>{ticket.status}</Badge>
            </div>
          </div>

          <ReadOnlyField label="Category" value={ticket.category.name} />
          <ReadOnlyField label="Related System" value={ticket.system.name} />
          <ReadOnlyField label="Description" value={ticket.description} />
          <div className="row g-0">
            <div className="col-12 col-md-6 pe-md-3">
              <ReadOnlyField label="Created" value={formatDate(ticket.createdAt)} />
            </div>
            <div className="col-12 col-md-6 ps-md-3">
              <ReadOnlyField label="Last Updated" value={formatDate(ticket.updatedAt)} />
            </div>
          </div>
          <ReadOnlyField label="Requester" value={ticket.requester.name} />

          <div className="mt-4">
            <h3 className="h6 fw-bold text-dark mb-3">Attachments ({ticket.attachments.length})</h3>
            {downloadError && (
              <div data-testid="download-error" role="alert" className="alert alert-danger py-2 small">
                {downloadError}
              </div>
            )}
            {ticket.attachments.length === 0 ? (
              <p className="text-secondary small mb-0" data-testid="no-attachments">
                No attachments.
              </p>
            ) : (
              <ul className="list-group" data-testid="attachment-list">
                {ticket.attachments.map((a) => (
                  <AttachmentRow
                    key={a.id}
                    attachment={a}
                    onDownload={handleDownload}
                    onRemove={openRemoveModal}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {isModalOpen &&
        removalTarget &&
        createPortal(
          <div
            ref={removalModalRef}
            className="modal d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="removal-modal-title"
            data-testid="removal-modal"
            onClick={() => {
              if (!isRemoving) closeRemoveModal();
            }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1055,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
              overflowY: "auto",
              backgroundColor: "rgba(0,0,0,0.5)",
            }}
          >
            <div
              className="modal-dialog"
              onClick={(e) => e.stopPropagation()}
              style={{ margin: 0, width: "100%", maxWidth: "500px" }}
            >
              <div className="modal-content">
                <div className="modal-header">
                  <h2 id="removal-modal-title" className="modal-title h6 fw-bold">
                    Remove attachment
                  </h2>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={closeRemoveModal}
                  />
                </div>
                <div className="modal-body">
                  <p className="text-secondary small mb-3 text-break">{removalTarget.filename}</p>
                  <label htmlFor="removal-reason" className="form-label fw-bold small text-dark">
                    Reason for removal
                  </label>
                  <textarea
                    id="removal-reason"
                    data-testid="removal-reason"
                    className="form-control"
                    rows={4}
                    maxLength={REMOVAL_REASON_MAX}
                    value={removalReason}
                    onChange={(e) => {
                      setRemovalReason(e.target.value);
                      setRemovalError(null);
                    }}
                    aria-invalid={removalError ? "true" : "false"}
                    autoFocus
                  />
                  <div className="form-text small">
                    Required: {REMOVAL_REASON_MIN}-{REMOVAL_REASON_MAX} characters.
                  </div>
                  {removalError && <ValidationMessage>{removalError}</ValidationMessage>}
                </div>
                <div className="modal-footer">
                  <Button variant="secondary" onClick={closeRemoveModal} disabled={isRemoving}>
                    Cancel
                  </Button>
                  <Button
                    data-testid="confirm-remove"
                    onClick={handleConfirmRemove}
                    isLoading={isRemoving}
                    loadingText="Removing..."
                  >
                    Confirm Removal
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}