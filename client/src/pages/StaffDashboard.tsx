import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Inbox, UserCheck } from "lucide-react";
import { getStaffSummary, type StaffSummary } from "../api.js";
import { drillDownToClientUrl } from "../utils/drilldown.js";
import { useAuth } from "../hooks/useAuth";
import Button from "../components/Button";
import styles from "./Dashboard.module.css";

// IT Staff landing page (Lab 4 ui-spec §3, FR-30, AC-48).
// Consumes the #136 summary API only — counting ticket rows client-side is
// forbidden (BR-26). Every metric drills into the pre-filtered queue (FR-31).
export default function StaffDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<StaffSummary | null>(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(false);
      try {
        const data = await getStaffSummary();
        if (cancelled) return;
        setSummary(data);
      } catch {
        if (cancelled) return;
        setSummary(null);
        setError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [user, retryKey]);

  if (isLoading) {
    return (
      <div className="container py-4" style={{ maxWidth: "1080px" }}>
        <h2 className="h4 fw-bold text-dark mb-3">Staff Dashboard</h2>
        <div className={styles.grid} data-testid="staff-dashboard-loading" aria-label="Loading dashboard">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={styles.skeleton} aria-hidden="true">
              <div className={styles.skeletonBar} style={{ width: "40%" }} />
              <div className={styles.skeletonBar} style={{ width: "70%" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="container py-4" style={{ maxWidth: "1080px" }}>
        <h2 className="h4 fw-bold text-dark mb-3" ref={headingRef} tabIndex={-1}>
          Staff Dashboard
        </h2>
        <div data-testid="staff-dashboard-error" role="alert" className="alert alert-danger d-flex justify-content-between align-items-center py-3">
          <span>Something went wrong. Retry.</span>
          <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const m = summary.metrics;
  const dd = summary.drillDown;
  const viewerId = summary.scope.viewerId;

  const cards = [
    {
      key: "unassignedCount",
      label: "Unassigned",
      hint: "Needs triage",
      value: m.unassignedCount,
      to: drillDownToClientUrl(dd.unassignedCount, "/queue?ownerId=0"),
      className: `${styles.card} ${styles.cardEmphasis}`,
      testid: "staff-card-unassigned",
    },
    {
      key: "myAssignedCount",
      label: "My Assigned",
      hint: "Non-terminal tickets I own",
      value: m.myAssignedCount,
      to: drillDownToClientUrl(dd.myAssignedCount, `/queue?ownerId=${viewerId}`),
      className: styles.card,
      testid: "staff-card-my-assigned",
    },
    {
      key: "myInProgressCount",
      label: "My In Progress",
      hint: "Actively working",
      value: m.myInProgressCount,
      to: drillDownToClientUrl(dd.myInProgressCount, `/queue?ownerId=${viewerId}&status=IN_PROGRESS`),
      className: styles.card,
      testid: "staff-card-my-in-progress",
    },
    {
      key: "waitingForRequesterCount",
      label: "Waiting for Requester",
      hint: "Needs their reply",
      value: m.waitingForRequesterCount,
      to: drillDownToClientUrl(dd.waitingForRequesterCount, "/queue?status=WAITING_FOR_REQUESTER"),
      className: styles.card,
      testid: "staff-card-waiting",
    },
    {
      key: "followUpDueCount",
      label: "Follow-Up Due",
      hint: "Latest action flagged follow-up",
      value: m.followUpDueCount,
      to: drillDownToClientUrl(dd.followUpDueCount, "/queue?followUp=true"),
      className: `${styles.card} ${styles.cardAmber}`,
      testid: "staff-card-followup",
    },
    {
      key: "resolvedTodayCount",
      label: "Resolved Today",
      hint: "UTC day",
      value: m.resolvedTodayCount,
      to: drillDownToClientUrl(dd.resolvedTodayCount, "/queue?status=RESOLVED&resolvedToday=true"),
      className: `${styles.card} ${styles.cardSuccess}`,
      testid: "staff-card-resolved-today",
    },
  ];

  const isEmpty = cards.every((c) => c.value === 0);

  return (
    <div className="container py-4" style={{ maxWidth: "1080px" }}>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-1">
        <div>
          <h2 className="h4 fw-bold text-dark mb-0" ref={headingRef} tabIndex={-1} data-testid="staff-dashboard-heading">
            Staff Dashboard
          </h2>
          <p className="text-secondary small mb-0">Operational overview — select a card to open its queue.</p>
        </div>
      </div>

      {isEmpty && (
        <div className="alert alert-success d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3" role="status" data-testid="staff-dashboard-empty">
          <span>Queue is clear. Nice work.</span>
          <Link to="/queue" className="btn btn-sm btn-success">
            Browse all tickets
          </Link>
        </div>
      )}

      <div className={`${styles.grid} mt-3`} data-testid="staff-dashboard-cards">
        {cards.map((c) => (
          <Link key={c.key} to={c.to} className={c.className} data-testid={c.testid} aria-label={`${c.label}: ${c.value} tickets. Open filtered queue.`}>
            <span className={styles.count} data-testid={`${c.testid}-count`}>
              {c.value}
            </span>
            <span className={styles.label}>{c.label}</span>
            <span className={styles.hint}>{c.hint}</span>
            <span className={styles.chevron} aria-hidden="true">
              Open queue →
            </span>
          </Link>
        ))}
      </div>

      <div className="card shadow-sm border-0 rounded-3 p-3 mt-3">
        <h3 className="h6 fw-bold text-dark mb-2">Shortcuts</h3>
        <div className={styles.shortcuts}>
          <Link
            to={drillDownToClientUrl(dd.myAssignedCount, `/queue?ownerId=${viewerId}`)}
            className="btn btn-success"
            data-testid="staff-shortcut-record-action"
          >
            <ClipboardList size={16} className="me-1" aria-hidden="true" />
            Record Action
          </Link>
          <Link to="/queue" className="btn btn-outline-secondary" data-testid="staff-shortcut-open-queue">
            <Inbox size={16} className="me-1" aria-hidden="true" />
            Open Queue
          </Link>
          <Link to={`/queue?ownerId=${viewerId}`} className="btn btn-outline-secondary" data-testid="staff-shortcut-my-work">
            <UserCheck size={16} className="me-1" aria-hidden="true" />
            My Work
          </Link>
        </div>
      </div>
    </div>
  );
}
