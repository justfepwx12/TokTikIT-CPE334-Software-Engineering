import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { UserCheck, UserPlus, Flag, Activity } from "lucide-react";
import {
  getStaffTicket,
  claimTicket,
  assignTicket,
  setItPriority,
  setTicketStatus,
  type StaffTicketDetail as StaffTicketDetailType,
  type TicketStatus,
  type TicketPriority,
} from "../api";
import { useAuth } from "../hooks/useAuth";
import Badge from "../components/Badge";
import { StatusBadge } from "../components/TicketBadges";
import Button from "../components/Button";
import TextInput from "../components/TextInput";
import PublicComments from "../components/PublicComments";
import InternalNotes from "../components/InternalNotes";

// Legal IT/Admin status edges (spec §6 matrix — mirrored from the server).
const MATRIX: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "IN_PROGRESS", "CANCELLED", "RESOLVED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["OPEN", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["OPEN", "IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: [],
};

// Button labels per target status. NEW has no incoming edge in the §6 matrix,
// so it intentionally has no label (Partial + fallback below).
const EDGE_LABEL: Partial<Record<TicketStatus, string>> = {
  OPEN: "Mark Open",
  IN_PROGRESS: "Mark In Progress",
  WAITING_FOR_REQUESTER: "Request Info",
  RESOLVED: "Resolve",
  CLOSED: "Close",
  REOPENED: "Reopen",
  CANCELLED: "Cancel",
};

const PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2">
      <div className="small text-secondary fw-medium">{label}</div>
      <div className="text-dark" data-testid={`ro-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
        {value}
      </div>
    </div>
  );
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function StaffTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const ticketId = Number(id);
  const idIsInvalid = !Number.isSafeInteger(ticketId) || ticketId <= 0;

  const [ticket, setTicket] = useState<StaffTicketDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  const [opError, setOpError] = useState<string | null>(null);
  const [opBusy, setOpBusy] = useState(false);
  const [assigneeId, setAssigneeId] = useState("");
  const [priorityDraft, setPriorityDraft] = useState<TicketPriority | "">("");

  const load = useCallback(async () => {
    if (idIsInvalid || !user) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getStaffTicket(ticketId);
      setTicket(data);
      setPriorityDraft(data.itPriority);
    } catch (err) {
      setTicket(null);
      setError(err instanceof Error ? err.message : "Failed to load ticket.");
    } finally {
      setIsLoading(false);
    }
  }, [idIsInvalid, user, ticketId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (idIsInvalid || !user) {
        setIsLoading(false);
        if (idIsInvalid) setError("Invalid ticket id.");
        return;
      }
      await load();
      if (cancelled) return;
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [idIsInvalid, user, retryKey, load]);

  const runOp = async (fn: () => Promise<Partial<StaffTicketDetailType>>) => {
    if (opBusy) return;
    setOpBusy(true);
    setOpError(null);
    try {
      const patch = await fn();
      setTicket((prev) => (prev ? { ...prev, ...patch } : prev));
    } catch (err) {
      setOpError(err instanceof Error ? err.message : "Operation failed.");
    } finally {
      setOpBusy(false);
    }
  };

  const handleClaim = () => void runOp(() => claimTicket(ticketId));
  const handleAssign = () => {
    const ownerId = Number(assigneeId);
    if (!Number.isSafeInteger(ownerId) || ownerId <= 0) {
      setOpError("Enter a valid staff user id to reassign.");
      return;
    }
    void runOp(() => assignTicket(ticketId, ownerId));
  };
  const handlePrioritySave = () => {
    if (!priorityDraft) return;
    const next = priorityDraft;
    void runOp(async () => {
      const patch = await setItPriority(ticketId, next);
      setPriorityDraft(patch.itPriority);
      return patch;
    });
  };
  const handleStatus = (status: TicketStatus) => {
    void runOp(() => setTicketStatus(ticketId, status));
  };

  if (isLoading) {
    return (
      <div className="container py-5 text-center text-secondary" data-testid="staff-detail-loading">
        Loading ticket…
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="container py-4" style={{ maxWidth: "960px" }}>
        <div data-testid="staff-detail-error" role="alert" className="alert alert-danger d-flex justify-content-between align-items-center">
          <span>{error ?? "Ticket not found."}</span>
          <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const edges = MATRIX[ticket.status] ?? [];
  const isOwner = ticket.owner?.id === user?.id;

  return (
    <div className="container py-4" style={{ maxWidth: "960px" }} data-testid="staff-ticket-detail">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <div className="text-secondary small" data-testid="staff-ticket-no">{ticket.ticketNo}</div>
          <h2 className="h4 fw-bold text-dark mb-0" data-testid="staff-ticket-title">{ticket.title}</h2>
        </div>
        <Link to="/queue" className="btn btn-outline-secondary btn-sm">
          Back to Queue
        </Link>
      </div>

      {opError && (
        <div className="alert alert-danger py-2 small" role="alert" data-testid="staff-op-error">
          {opError}
        </div>
      )}

      {/* Requester-submitted block — read-only (BR-14) */}
      <section className="card shadow-sm border-0 rounded-3 p-3 mb-3" aria-label="Requester details">
        <h3 className="h6 fw-bold text-dark mb-3">Requester Details (read-only)</h3>
        <div className="row">
          <div className="col-md-6">
            <ReadOnlyField label="Title" value={ticket.title} />
            <ReadOnlyField label="Description" value={ticket.description} />
            <ReadOnlyField label="Requested Priority" value={`${ticket.requestedPriority} (read-only)`} />
          </div>
          <div className="col-md-6">
            <ReadOnlyField label="Category" value={ticket.category.name} />
            <ReadOnlyField label="System" value={ticket.system.name} />
            <ReadOnlyField label="Requester" value={ticket.requester.name} />
            <ReadOnlyField label="Created" value={formatDate(ticket.createdAt)} />
            <ReadOnlyField label="Updated" value={formatDate(ticket.updatedAt)} />
          </div>
        </div>
      </section>

      {/* Ownership block */}
      <section className="card shadow-sm border-0 rounded-3 p-3 mb-3" aria-label="Ownership">
        <h3 className="h6 fw-bold text-dark mb-3">Ownership</h3>
        <p className="mb-2">
          Current owner:{" "}
          <strong data-testid="staff-owner">
            {ticket.owner ? ticket.owner.name : "Unassigned"}
          </strong>
        </p>
        <div className="d-flex flex-wrap gap-2 align-items-end">
          {!ticket.owner && (
            <Button type="button" onClick={handleClaim} disabled={opBusy} data-testid="staff-claim">
              <UserCheck size={16} className="me-1" /> Claim Ticket
            </Button>
          )}
          <div>
            <label className="form-label small fw-bold" htmlFor="staff-assignee">
              Reassign to staff id
            </label>
            <div className="d-flex gap-2">
              <TextInput
                id="staff-assignee"
                data-testid="staff-assignee"
                inputMode="numeric"
                placeholder="e.g. 9"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              />
              <Button type="button" onClick={handleAssign} disabled={opBusy} data-testid="staff-assign">
                <UserPlus size={16} className="me-1" /> {ticket.owner ? "Reassign" : "Assign"}
              </Button>
            </div>
            <div className="form-text">Target must be an active IT Staff member or Administrator.</div>
          </div>
        </div>
        {isOwner && <div className="small text-success mt-2">You are the owner of this ticket.</div>}
      </section>

      {/* IT Priority block */}
      <section className="card shadow-sm border-0 rounded-3 p-3 mb-3" aria-label="IT Priority">
        <h3 className="h6 fw-bold text-dark mb-3">IT Priority</h3>
        <div className="d-flex gap-2 align-items-end">
          <div>
            <label className="form-label small fw-bold" htmlFor="staff-it-priority">
              IT Priority
            </label>
            <select
              id="staff-it-priority"
              data-testid="staff-it-priority"
              className="form-select"
              value={priorityDraft}
              onChange={(e) => setPriorityDraft(e.target.value as TicketPriority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" onClick={handlePrioritySave} disabled={opBusy} data-testid="staff-priority-save">
            <Flag size={16} className="me-1" /> Save Priority
          </Button>
          <span className="small text-secondary">Current: <strong>{ticket.itPriority}</strong></span>
        </div>
      </section>

      {/* Status workflow block — only legal matrix edges are offered */}
      <section className="card shadow-sm border-0 rounded-3 p-3 mb-3" aria-label="Status workflow">
        <h3 className="h6 fw-bold text-dark mb-1">Status Workflow</h3>
        <p className="small text-secondary">
          Current status: <StatusBadge status={ticket.status} />
        </p>
        {edges.length === 0 ? (
          <p className="small text-secondary mb-0" data-testid="staff-no-transitions">
            No transitions available — this ticket is cancelled (terminal).
          </p>
        ) : (
          <div className="d-flex flex-wrap gap-2">
            {edges.map((target) => (
              <Button
                key={target}
                type="button"
                variant="secondary"
                onClick={() => handleStatus(target)}
                disabled={opBusy}
                data-testid={`staff-status-${target}`}
              >
                <Activity size={16} className="me-1" /> {EDGE_LABEL[target] ?? target}
              </Button>
            ))}
          </div>
        )}
      </section>

      {/* Attachments — read-only list for staff (no soft-remove UI) */}
      <section className="card shadow-sm border-0 rounded-3 p-3 mb-3" aria-label="Attachments">
        <h3 className="h6 fw-bold text-dark mb-3">Attachments ({ticket.attachments.length})</h3>
        {ticket.attachments.length === 0 ? (
          <p className="small text-secondary mb-0">No attachments.</p>
        ) : (
          <ul className="list-group">
            {ticket.attachments.map((a) => (
              <li key={a.id} className="list-group-item d-flex justify-content-between align-items-center">
                <span>
                  {a.filename}{" "}
                  <span className="text-secondary small">
                    ({a.mimeType}, {a.size} bytes)
                  </span>
                </span>
                {a.isRemoved && <Badge color="gray">Removed</Badge>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Communication columns (ui-spec §6, BR-21): two side-by-side panels on
          desktop, stacked on mobile. Notes stay visually distinct (yellow tint
          + lock) so they are never posted publicly by accident. */}
      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <PublicComments ticketId={ticket.id} />
        </div>
        <div className="col-12 col-lg-6">
          <InternalNotes ticketId={ticket.id} />
        </div>
      </div>
    </div>
  );
}
