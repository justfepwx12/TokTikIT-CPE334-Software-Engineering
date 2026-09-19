import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  FilterX,
  ArrowUpDown,
} from "lucide-react";
import {
  getCategories,
  getSystems,
  getStaffTickets,
  type Category,
  type RelatedSystem,
  type TicketStatus,
  type TicketPriority,
  type QueueSortField,
  type StaffTicketQuery,
  type StaffTicket,
  type Pagination,
} from "../api";
import { useAuth } from "../hooks/useAuth";
import { PriorityBadge, StatusBadge } from "../components/TicketBadges";
import Button from "../components/Button";
import TextInput from "../components/TextInput";

const DEFAULT_QUERY: StaffTicketQuery = {
  sort: "updatedAt",
  order: "desc",
};

const STATUSES: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];
const PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const PAGE_SIZES = [10, 20, 50];
const SORT_FIELDS: Array<{ value: QueueSortField; label: string }> = [
  { value: "updatedAt", label: "Updated" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
];

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function EmptyState({ hasActiveFilters }: { hasActiveFilters: boolean }) {
  return (
    <div data-testid={hasActiveFilters ? "no-results" : "empty-state"} className="text-center py-5">
      <FilterX size={40} className="text-secondary mb-3" />
      <h5 className="fw-bold text-dark mb-1">
        {hasActiveFilters ? "No matching tickets" : "Queue is empty"}
      </h5>
      <p className="text-secondary small mb-0">
        {hasActiveFilters
          ? "No tickets match your current search or filters."
          : "There are no tickets in the queue."}
      </p>
    </div>
  );
}

function QueueTable({ tickets, onOpen }: { tickets: StaffTicket[]; onOpen: (id: number) => void }) {
  return (
    <div className="d-none d-lg-block overflow-auto">
      <table className="table table-hover align-middle mb-0 table-stable" data-testid="queue-table">
        <colgroup>
          <col style={{ width: "140px" }} />
          <col />
          <col style={{ width: "130px" }} />
          <col style={{ width: "170px" }} />
          <col style={{ width: "100px" }} />
          <col style={{ width: "100px" }} />
          <col style={{ width: "190px" }} />
          <col style={{ width: "120px" }} />
          <col style={{ width: "100px" }} />
        </colgroup>
        <thead className="table-light">
          <tr>
            <th scope="col">Ticket No</th>
            <th scope="col">Title</th>
            <th scope="col">Requester</th>
            <th scope="col">Category / System</th>
            <th scope="col">Requested</th>
            <th scope="col">IT Priority</th>
            <th scope="col">Status</th>
            <th scope="col">Owner</th>
            <th scope="col">Updated</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr
              key={t.id}
              data-testid="queue-row"
              role="button"
              tabIndex={0}
              onClick={() => onOpen(t.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(t.id);
                }
              }}
            >
              <td className="fw-semibold text-decoration-underline text-brand" data-testid="queue-row-ticket-no" title={t.ticketNo}>
                {t.ticketNo}
              </td>
              <td className="text-dark" title={t.title}>{t.title}</td>
              <td title={t.requester.name}>{t.requester.name}</td>
              <td className="small" title={`${t.category.name} / ${t.system.name}`}>
                {t.category.name} / {t.system.name}
              </td>
              <td>
                <PriorityBadge priority={t.requestedPriority} />
              </td>
              <td>
                <PriorityBadge priority={t.itPriority} />
              </td>
              <td>
                <StatusBadge status={t.status} />
              </td>
              <td title={t.owner ? t.owner.name : "Unassigned"}>{t.owner ? t.owner.name : <span className="text-secondary fst-italic">Unassigned</span>}</td>
              <td className="text-secondary small">{formatDate(t.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QueueCards({ tickets, onOpen }: { tickets: StaffTicket[]; onOpen: (id: number) => void }) {
  return (
    <div className="d-lg-none d-flex flex-column gap-3">
      {tickets.map((t) => (
        <div
          key={t.id}
          data-testid="queue-card"
          role="button"
          tabIndex={0}
          onClick={() => onOpen(t.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen(t.id);
            }
          }}
          className="card border-0 shadow-sm rounded-3 p-3"
        >
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div>
              <div className="fw-semibold text-brand small text-decoration-underline">{t.ticketNo}</div>
              <div className="fw-bold text-dark">{t.title}</div>
              <div className="text-secondary small">
                {t.requester.name} · {t.owner ? t.owner.name : "Unassigned"}
              </div>
            </div>
            <div className="d-flex flex-column gap-1 align-items-end">
              <PriorityBadge priority={t.itPriority} />
              <StatusBadge status={t.status} />
            </div>
          </div>
          <div className="mt-2 text-secondary small">Updated {formatDate(t.updatedAt)}</div>
        </div>
      ))}
    </div>
  );
}

export default function TicketQueue() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<RelatedSystem[]>([]);

  const [draftSearch, setDraftSearch] = useState("");
  const [appliedQuery, setAppliedQuery] = useState<StaffTicketQuery>(DEFAULT_QUERY);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [tickets, setTickets] = useState<StaffTicket[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const loadOptions = async () => {
      try {
        const [cats, sys] = await Promise.all([getCategories(), getSystems()]);
        if (!cancelled) {
          setCategories(cats);
          setSystems(sys);
        }
      } catch {
        // Filter dropdowns stay empty; queue still renders.
      }
    };
    loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced search (ui-spec §5): typing refetches without a submit click.
  // Page reset happens in the timeout callback (event path), not synchronously
  // in the effect body — avoids react-hooks/set-state-in-effect cascading renders.
  // The ref guard prevents resetting the page when the trimmed value is unchanged.
  const appliedSearchRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = draftSearch.trim() || undefined;
      if (next === appliedSearchRef.current) return;
      appliedSearchRef.current = next;
      setAppliedQuery((prev) => ({ ...prev, search: next }));
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draftSearch]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      const query: StaffTicketQuery = { ...appliedQuery, page, limit };
      try {
        const res = await getStaffTickets(query);
        if (cancelled) return;
        setTickets(res.tickets);
        setPagination(res.pagination);
      } catch (err) {
        if (cancelled) return;
        setTickets([]);
        setPagination(null);
        setError(err instanceof Error ? err.message : "Failed to load the queue.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user, appliedQuery, page, limit, retryKey]);

  const updateQuery = (patch: Partial<StaffTicketQuery>) => {
    // Reset to page 1 in the event handler (not in an effect).
    setAppliedQuery((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const handleClearFilters = () => {
    setDraftSearch("");
    appliedSearchRef.current = undefined;
    setAppliedQuery({ ...DEFAULT_QUERY });
    setPage(1);
  };

  const handleOpenTicket = (id: number) => {
    // Staff Ticket Detail lands in Issue #100 — route is pre-wired.
    navigate(`/tickets/${id}`);
  };

  // Owner options are derived from the loaded page (a dedicated user-picker
  // API lands with Issue 8 admin endpoints).
  const visibleOwners = Array.from(
    new Map(tickets.filter((t) => t.owner).map((t) => [t.owner!.id, t.owner!.name])).entries()
  );

  const hasActiveFilters = Boolean(
    appliedQuery.search ||
      appliedQuery.categoryId ||
      appliedQuery.systemId ||
      appliedQuery.status ||
      appliedQuery.priority ||
      appliedQuery.ownerId !== undefined
  );

  return (
    <div className="container py-4" style={{ maxWidth: "1200px" }}>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h2 className="h4 fw-bold text-dark mb-0">Ticket Queue</h2>
          <p className="text-secondary small mb-0">All requesters · IT Staff view</p>
        </div>
        {hasActiveFilters && (
          <Button variant="secondary" type="button" onClick={handleClearFilters} aria-label="Clear Filters">
            <FilterX size={16} className="me-1" />
            Clear Filters
          </Button>
        )}
      </div>

      <div className="card shadow-sm border-0 rounded-3 p-3 mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-12 col-md-3">
            <label className="form-label fw-bold small text-dark" htmlFor="queue-search">
              Search
            </label>
            <TextInput
              id="queue-search"
              data-testid="queue-search"
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              placeholder="Search title or description..."
            />
          </div>

          <div className="col-6 col-md-2">
            <label className="form-label fw-bold small text-dark" htmlFor="queue-status">
              Status
            </label>
            <select
              id="queue-status"
              data-testid="queue-status"
              className="form-select"
              value={appliedQuery.status ?? ""}
              onChange={(e) =>
                updateQuery({ status: (e.target.value || undefined) as TicketStatus | undefined })
              }
            >
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-2">
            <label className="form-label fw-bold small text-dark" htmlFor="queue-priority">
              IT Priority
            </label>
            <select
              id="queue-priority"
              data-testid="queue-priority"
              className="form-select"
              value={appliedQuery.priority ?? ""}
              onChange={(e) =>
                updateQuery({ priority: (e.target.value || undefined) as TicketPriority | undefined })
              }
            >
              <option value="">All</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-2">
            <label className="form-label fw-bold small text-dark" htmlFor="queue-category">
              Category
            </label>
            <select
              id="queue-category"
              data-testid="queue-category"
              className="form-select"
              value={appliedQuery.categoryId ?? ""}
              onChange={(e) =>
                updateQuery({ categoryId: e.target.value ? Number(e.target.value) : undefined })
              }
            >
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-3">
            <label className="form-label fw-bold small text-dark" htmlFor="queue-system">
              System
            </label>
            <select
              id="queue-system"
              data-testid="queue-system"
              className="form-select"
              value={appliedQuery.systemId ?? ""}
              onChange={(e) =>
                updateQuery({ systemId: e.target.value ? Number(e.target.value) : undefined })
              }
            >
              <option value="">All</option>
              {systems.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-2">
            <label className="form-label fw-bold small text-dark" htmlFor="queue-owner">
              Owner
            </label>
            <select
              id="queue-owner"
              data-testid="queue-owner"
              className="form-select"
              value={appliedQuery.ownerId ?? ""}
              onChange={(e) =>
                updateQuery({ ownerId: e.target.value === "" ? undefined : Number(e.target.value) })
              }
            >
              <option value="">All</option>
              <option value={0}>Unassigned</option>
              {visibleOwners.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-2">
            <label className="form-label fw-bold small text-dark" htmlFor="queue-sort">
              Sort by
            </label>
            <select
              id="queue-sort"
              data-testid="queue-sort"
              className="form-select"
              value={appliedQuery.sort ?? "updatedAt"}
              onChange={(e) =>
                updateQuery({ sort: e.target.value as QueueSortField })
              }
            >
              {SORT_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-2">
            <Button
              variant="secondary"
              type="button"
              data-testid="queue-order"
              onClick={() =>
                updateQuery({ order: appliedQuery.order === "asc" ? "desc" : "asc" })
              }
              aria-label="Toggle sort order"
            >
              <ArrowUpDown size={16} className="me-1" />
              {appliedQuery.order === "asc" ? "Asc" : "Desc"}
            </Button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div data-testid="queue-loading" className="text-center py-5 text-secondary">
          Loading the queue…
        </div>
      )}

      {!isLoading && error && (
        <div data-testid="queue-error" role="alert" className="alert alert-danger d-flex justify-content-between align-items-center py-3">
          <span>{error}</span>
          <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !error && tickets.length === 0 && (
        <EmptyState hasActiveFilters={hasActiveFilters} />
      )}

      {!isLoading && !error && tickets.length > 0 && (
        <>
          <QueueTable tickets={tickets} onOpen={handleOpenTicket} />
          <QueueCards tickets={tickets} onOpen={handleOpenTicket} />
        </>
      )}

      {!isLoading && !error && pagination && pagination.totalPages > 1 && (
        <div className="d-flex flex-wrap justify-content-center align-items-center gap-3 my-4">
          <span className="small text-secondary" data-testid="queue-pagination-summary">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} tickets
          </span>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            aria-label="Previous page"
            disabled={pagination.page <= 1}
            onClick={() => setPage(pagination.page - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              className={`btn btn-sm ${p === pagination.page ? "btn-success" : "btn-outline-secondary"}`}
              data-testid="queue-page-number"
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            aria-label="Next page"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPage(pagination.page + 1)}
          >
            <ChevronRight size={16} />
          </button>
          <select
            className="form-select form-select-sm"
            style={{ width: "auto" }}
            aria-label="Tickets per page"
            data-testid="queue-page-size"
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n} per page
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="d-flex align-items-center gap-2 text-secondary small mt-2">
        <Search size={14} />
        <span>For Claim, IT Priority and Status actions, open the ticket detail screen.</span>
      </div>
    </div>
  );
}
