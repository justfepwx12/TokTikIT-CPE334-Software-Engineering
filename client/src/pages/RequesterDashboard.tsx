import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PlusCircle } from "lucide-react";
import { getRequesterSummary, type RequesterSummary } from "../api.js";
import { drillDownToClientUrl } from "../utils/drilldown.js";
import { useAuth } from "../hooks/useAuth";
import Button from "../components/Button";
import styles from "./Dashboard.module.css";

// Requester landing page (Lab 4 ui-spec §2, FR-29, AC-49).
// Counts are scoped server-side to requesterId = me for every role (BR-25),
// so this screen can never leak foreign tickets. Staff/Admin visitors see
// counts only: their drill-down descriptors target GET /api/tickets, which
// requires the REQUESTER role (403 otherwise), so cards render static with a
// pointer to the staff dashboard instead (api-spec §2).
export default function RequesterDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<RequesterSummary | null>(null);
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
        const data = await getRequesterSummary();
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
        <h2 className="h4 fw-bold text-dark mb-3">My Dashboard</h2>
        <div className={styles.grid} data-testid="requester-dashboard-loading" aria-label="Loading dashboard">
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
          My Dashboard
        </h2>
        <div data-testid="requester-dashboard-error" role="alert" className="alert alert-danger d-flex justify-content-between align-items-center py-3">
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
  const isRequester = user?.role === "REQUESTER";

  const cards = [
    {
      key: "myOpen",
      label: "My Open",
      hint: "New, open or in progress",
      value: m.myOpen,
      to: drillDownToClientUrl(dd.myOpen, "/my-tickets?status=NEW,OPEN,IN_PROGRESS"),
      testid: "requester-card-open",
    },
    {
      key: "myWaiting",
      label: "Waiting for Me",
      hint: "Needs my reply",
      value: m.myWaiting,
      to: drillDownToClientUrl(dd.myWaiting, "/my-tickets?status=WAITING_FOR_REQUESTER"),
      testid: "requester-card-waiting",
      accent: styles.cardAmber,
    },
    {
      key: "myResolved",
      label: "Resolved",
      hint: "Fixed, awaiting closure",
      value: m.myResolved,
      to: drillDownToClientUrl(dd.myResolved, "/my-tickets?status=RESOLVED"),
      testid: "requester-card-resolved",
    },
    {
      key: "myClosed",
      label: "Closed",
      hint: "Completed",
      value: m.myClosed,
      to: drillDownToClientUrl(dd.myClosed, "/my-tickets?status=CLOSED"),
      testid: "requester-card-closed",
    },
    {
      key: "myReopened",
      label: "Reopened",
      hint: "Back in the queue",
      value: m.myReopened,
      to: drillDownToClientUrl(dd.myReopened, "/my-tickets?status=REOPENED"),
      testid: "requester-card-reopened",
    },
    {
      key: "myCancelled",
      label: "Cancelled",
      hint: "Withdrawn",
      value: m.myCancelled,
      to: drillDownToClientUrl(dd.myCancelled, "/my-tickets?status=CANCELLED"),
      testid: "requester-card-cancelled",
    },
  ];

  const isEmpty =
    m.myOpen === 0 &&
    m.myWaiting === 0 &&
    m.myResolved === 0 &&
    m.myClosed === 0 &&
    m.myReopened === 0 &&
    m.myCancelled === 0 &&
    m.myFollowUpOpen === 0;

  const cardBody = (label: string, hint: string, value: number, testid: string) => (
    <>
      <span className={styles.count} data-testid={`${testid}-count`}>
        {value}
      </span>
      <span className={styles.label}>{label}</span>
      <span className={styles.hint}>{hint}</span>
    </>
  );

  return (
    <div className="container py-4" style={{ maxWidth: "1080px" }}>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-1">
        <div>
          <h2 className="h4 fw-bold text-dark mb-0" ref={headingRef} tabIndex={-1} data-testid="requester-dashboard-heading">
            My Dashboard
          </h2>
          <p className="text-secondary small mb-0">Your tickets at a glance — select a card to open its list.</p>
        </div>
      </div>

      {m.myFollowUpOpen > 0 && (
        <div className={`${styles.attention} mt-3`} role="status" data-testid="requester-followup-strip">
          <strong>IT flagged {m.myFollowUpOpen} of your ticket{m.myFollowUpOpen === 1 ? "" : "s"} for follow-up.</strong>{" "}
          {isRequester ? (
            <Link to={drillDownToClientUrl(dd.myFollowUpOpen, "/my-tickets?followUp=true")} data-testid="requester-followup-link">
              View flagged tickets →
            </Link>
          ) : (
            <span className="small text-secondary">Details are available on the Staff Dashboard.</span>
          )}
        </div>
      )}

      {isEmpty && (
        <div className="card shadow-sm border-0 rounded-3 p-4 mt-3 text-center" data-testid="requester-dashboard-empty" role="status">
          <p className="fw-bold text-dark mb-1">You have no tickets yet.</p>
          <p className="text-secondary small mb-3">Describe your issue and the IT team will pick it up.</p>
          <Link to="/create-ticket" className="btn btn-success" data-testid="requester-empty-cta">
            <PlusCircle size={16} className="me-1" aria-hidden="true" />
            Create your first ticket
          </Link>
        </div>
      )}

      {!isRequester && (
        <p className="text-secondary small mt-3 mb-0" data-testid="requester-counts-only-note">
          Showing counts for tickets you requested. Drill-down lists are available from the Staff Dashboard.
        </p>
      )}

      <div className={`${styles.grid} mt-3`} data-testid="requester-dashboard-cards">
        {cards.map((c) =>
          isRequester ? (
            <Link
              key={c.key}
              to={c.to}
              className={`${styles.card} ${c.accent ?? ""}`}
              data-testid={c.testid}
              aria-label={`${c.label}: ${c.value} tickets. Open filtered list.`}
            >
              {cardBody(c.label, c.hint, c.value, c.testid)}
              <span className={styles.chevron} aria-hidden="true">
                Open list →
              </span>
            </Link>
          ) : (
            <div key={c.key} className={`${styles.card} ${c.accent ?? ""}`} data-testid={c.testid}>
              {cardBody(c.label, c.hint, c.value, c.testid)}
            </div>
          )
        )}
      </div>
    </div>
  );
}
