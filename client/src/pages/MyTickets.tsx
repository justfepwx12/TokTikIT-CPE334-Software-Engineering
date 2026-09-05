import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  FilterX,
} from "lucide-react";
import {
  getCategories,
  getSystems,
  getTickets,
  type Category,
  type RelatedSystem,
  type Status,
  type Priority,
  type SortField,
  type SortOrder,
  type TicketQuery,
  type TicketSummary,
  type Pagination,
} from "../api";
import { useRequester } from "../hooks/useRequester";
import Badge from "../components/Badge";
import Button from "../components/Button";
import TextInput from "../components/TextInput";

const DEFAULT_QUERY: TicketQuery = {
  sort: "createdAt",
  order: "desc",
};

const STATUSES: Status[] = ["PENDING", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const PAGE_SIZES = [10, 20, 50];

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
  return d.toLocaleDateString();
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge color={PRIORITY_COLOR[priority]}>{priority}</Badge>;
}

function StatusBadge({ status }: { status: Status }) {
  return <Badge color={STATUS_COLOR[status]}>{status}</Badge>;
}

function EmptyState({ onReset, hasActiveFilters }: { onReset: () => void; hasActiveFilters: boolean }) {
  return (
    <div data-testid={hasActiveFilters ? "no-results" : "empty-state"} className="text-center py-5">
      <FilterX size={40} className="text-secondary mb-3" />
      <h5 className="fw-bold text-dark mb-1">
        {hasActiveFilters ? "No matching tickets" : "No tickets yet"}
      </h5>
      <p className="text-secondary small mb-0">
        {hasActiveFilters
          ? "No tickets match your current search or filters."
          : "Tickets you create will appear here."}
      </p>
      {hasActiveFilters && (
        <Button variant="secondary" className="mt-3" onClick={onReset}>
          Clear Filters
        </Button>
      )}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div data-testid="tickets-error" role="alert" className="alert alert-danger d-flex justify-content-between align-items-center py-3">
      <span>{message}</span>
      <Button variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function DesktopTable({ tickets }: { tickets: TicketSummary[] }) {
  return (
    <div className="d-none d-md-block overflow-auto">
      <table className="table table-hover align-middle mb-0" data-testid="tickets-table">
        <thead className="table-light">
          <tr>
            <th scope="col">Ticket No</th>
            <th scope="col">Title</th>
            <th scope="col">Category</th>
            <th scope="col">Priority</th>
            <th scope="col">Status</th>
            <th scope="col">Created</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id} data-testid="ticket-row">
              <td className="fw-semibold text-dark">{t.ticketNo}</td>
              <td className="text-dark">{t.title}</td>
              <td>{t.category.name}</td>
              <td>
                <PriorityBadge priority={t.priority} />
              </td>
              <td>
                <StatusBadge status={t.status} />
              </td>
              <td className="text-secondary small">{formatDate(t.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MobileCards({ tickets }: { tickets: TicketSummary[] }) {
  return (
    <div className="d-md-none d-flex flex-column gap-3">
      {tickets.map((t) => (
        <div
          key={t.id}
          data-testid="ticket-card"
          className="card border-0 shadow-sm rounded-3 p-3"
        >
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div>
              <div className="fw-semibold text-dark small">{t.ticketNo}</div>
              <div className="fw-bold text-dark">{t.title}</div>
              <div className="text-secondary small">{t.category.name}</div>
            </div>
            <div className="d-flex flex-column gap-1 align-items-end">
              <PriorityBadge priority={t.priority} />
              <StatusBadge status={t.status} />
            </div>
          </div>
          <div className="mt-2 text-secondary small">Created {formatDate(t.createdAt)}</div>
        </div>
      ))}
    </div>
  );
}

function PaginationBar({
  pagination,
  onPageChange,
  onLimitChange,
}: {
  pagination: Pagination;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}) {
  const { page, limit, totalPages } = pagination;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="d-flex flex-wrap justify-content-center align-items-center gap-3 my-4">
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft size={16} />
      </button>

      <ul className="pagination mb-0">
        {pages.map((p) => (
          <li key={p} className={`page-item ${p === page ? "active" : ""}`}>
            <button
              type="button"
              className="page-link"
              data-testid="page-number"
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        aria-label="Next page"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight size={16} />
      </button>

      <select
        className="form-select form-select-sm"
        style={{ width: "auto" }}
        aria-label="Tickets per page"
        data-testid="page-size"
        value={limit}
        onChange={(e) => onLimitChange(Number(e.target.value))}
      >
        {PAGE_SIZES.map((n) => (
          <option key={n} value={n}>
            {n} per page
          </option>
        ))}
      </select>
    </div>
  );
}

export default function MyTickets() {
  const { requester } = useRequester();
  const requesterId = requester?.id;

  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<RelatedSystem[]>([]);

  const [draftSearch, setDraftSearch] = useState("");
  const [appliedQuery, setAppliedQuery] = useState<TicketQuery>(DEFAULT_QUERY);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [tickets, setTickets] = useState<TicketSummary[]>([]);
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
        // Filter dropdowns stay empty; list still renders.
      }
    };

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (requesterId === undefined) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      const query: TicketQuery = { ...appliedQuery, page, limit };
      try {
        const res = await getTickets(query, requesterId);
        if (cancelled) return;
        setTickets(res.tickets);
        setPagination(res.pagination);
      } catch (err) {
        if (cancelled) return;
        setTickets([]);
        setPagination(null);
        setError(err instanceof Error ? err.message : "Failed to load tickets.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [requesterId, appliedQuery, page, limit, retryKey]);

  const updateQuery = (patch: Partial<TicketQuery>) => {
    setAppliedQuery((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    updateQuery({ search: draftSearch.trim() || undefined });
  };

  const handleClearFilters = () => {
    setDraftSearch("");
    setAppliedQuery(DEFAULT_QUERY);
    setPage(1);
  };

  const handleSortChange = (draftSort: SortField) => {
    let order: SortOrder;
    if (appliedQuery.sort !== draftSort) {
      order = "desc";
    } else {
      order = appliedQuery.order === "desc" ? "asc" : "desc";
    }
    updateQuery({ sort: draftSort, order });
  };

  const hasActiveFilters = Boolean(
    appliedQuery.search ||
      appliedQuery.categoryId ||
      appliedQuery.systemId ||
      appliedQuery.status ||
      appliedQuery.priority
  );

  return (
    <div className="container py-4" style={{ maxWidth: "1080px" }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="h4 fw-bold text-dark mb-0">My Tickets</h2>
          <p className="text-secondary small mb-0">
            {requester ? `Showing tickets for ${requester.name}` : "My tickets"}
          </p>
        </div>
      </div>

      <div className="card shadow-sm border-0 rounded-3 p-3 mb-3">
        <form className="row g-2 align-items-end" onSubmit={handleSearchSubmit} noValidate>
          <div className="col-12 col-md-4">
            <label className="form-label fw-bold small text-dark" htmlFor="ticket-search">
              Search
            </label>
            <TextInput
              id="ticket-search"
              data-testid="ticket-search"
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              placeholder="Search title or description..."
            />
          </div>

          <div className="col-6 col-md-2">
            <label className="form-label fw-bold small text-dark" htmlFor="filter-category">
              Category
            </label>
            <select
              id="filter-category"
              data-testid="filter-category"
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

          <div className="col-6 col-md-2">
            <label className="form-label fw-bold small text-dark" htmlFor="filter-system">
              System
            </label>
            <select
              id="filter-system"
              data-testid="filter-system"
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
            <label className="form-label fw-bold small text-dark" htmlFor="filter-status">
              Status
            </label>
            <select
              id="filter-status"
              data-testid="filter-status"
              className="form-select"
              value={appliedQuery.status ?? ""}
              onChange={(e) =>
                updateQuery({ status: (e.target.value || undefined) as Status | undefined })
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
            <label className="form-label fw-bold small text-dark" htmlFor="filter-priority">
              Priority
            </label>
            <select
              id="filter-priority"
              data-testid="filter-priority"
              className="form-select"
              value={appliedQuery.priority ?? ""}
              onChange={(e) =>
                updateQuery({ priority: (e.target.value || undefined) as Priority | undefined })
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

          <div className="col-12 col-md-12 d-flex gap-2 mt-2">
            <Button type="submit" variant="secondary">
              <Search size={16} className="me-1" />
              Apply
            </Button>
            <Button variant="secondary" type="button" onClick={handleClearFilters}>
              Clear
            </Button>
            <div className="d-flex align-items-center ms-auto gap-2">
              <span className="small text-secondary">Sort</span>
              <button
                type="button"
                className={`btn btn-sm ${appliedQuery.sort === "createdAt" ? "btn-brand text-white" : "btn-outline-secondary"}`}
                data-testid="sort-createdAt"
                onClick={() => handleSortChange("createdAt")}
              >
                Date {appliedQuery.sort === "createdAt" ? (appliedQuery.order === "asc" ? "↑" : "↓") : ""}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${appliedQuery.sort === "priority" ? "btn-brand text-white" : "btn-outline-secondary"}`}
                data-testid="sort-priority"
                onClick={() => handleSortChange("priority")}
              >
                Priority {appliedQuery.sort === "priority" ? (appliedQuery.order === "asc" ? "↑" : "↓") : ""}
              </button>
            </div>
          </div>
        </form>
      </div>

      {error && (
        <ErrorState
          message={error}
          onRetry={() => setRetryKey((k) => k + 1)}
        />
      )}

      {isLoading && !error ? (
        <div className="py-5 text-center text-secondary" data-testid="tickets-loading">
          Loading tickets...
        </div>
      ) : !error && tickets.length === 0 ? (
        <div className="card shadow-sm border-0 rounded-3">
          <EmptyState onReset={handleClearFilters} hasActiveFilters={hasActiveFilters} />
        </div>
      ) : !error ? (
        <>
          <div className="card shadow-sm border-0 rounded-3 overflow-hidden">
            <DesktopTable tickets={tickets} />
            <MobileCards tickets={tickets} />
          </div>
          {pagination && (
            <PaginationBar
              pagination={pagination}
              onPageChange={setPage}
              onLimitChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
            />
          )}
        </>
      ) : null}
    </div>
  );
}