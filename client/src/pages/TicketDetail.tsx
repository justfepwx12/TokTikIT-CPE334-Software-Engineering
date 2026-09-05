import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, FileText, Download, File } from "lucide-react";
import { getTicket, type Status, type Priority, type TicketDetail } from "../api";
import { useRequester } from "../hooks/useRequester";
import Badge from "../components/Badge";
import Button from "../components/Button";

const STATUS_COLOR: Record<Status, "gray" | "blue" | "green"> = {
  PENDING: "gray",
  IN_PROGRESS: "blue",
  RESOLVED: "green",
  CLOSED: "gray",
};

const PRIORITY_COLOR: Record<Priority, "gray" | "yellow" | "red"> = {
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

function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
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

function AttachmentRow({ attachment }: { attachment: TicketDetail["attachments"][number] }) {
  const Icon =
    isImageMime(attachment.mimeType) || attachment.mimeType === "application/pdf"
      ? FileText
      : File;
  return (
    <li className="list-group-item d-flex align-items-center gap-3 py-3">
      <Icon size={20} className="text-secondary flex-shrink-0" />
      <div className="flex-grow-1 min-w-0">
        <div className="fw-semibold text-dark text-truncate">{attachment.filename}</div>
        <div className="text-secondary small">{formatSize(attachment.size)}</div>
      </div>
      <span className="small text-secondary text-nowrap">{attachment.mimeType}</span>
      <Button variant="secondary" className="flex-shrink-0" aria-label={`Download ${attachment.filename}`} data-testid={`attachment-download-${attachment.id}`}>
        <Download size={16} className="me-1" />
        Download
      </Button>
    </li>
  );
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { requester } = useRequester();

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  const requesterId = requester?.id;
  const ticketId = Number(id);
  const idIsInvalid = !Number.isSafeInteger(ticketId) || ticketId <= 0;

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
              <Badge color={PRIORITY_COLOR[ticket.priority]} data-testid="ticket-priority">
                {ticket.priority}
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
            {ticket.attachments.length === 0 ? (
              <p className="text-secondary small mb-0" data-testid="no-attachments">
                No attachments.
              </p>
            ) : (
              <ul className="list-group" data-testid="attachment-list">
                {ticket.attachments.map((a) => (
                  <AttachmentRow key={a.id} attachment={a} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}