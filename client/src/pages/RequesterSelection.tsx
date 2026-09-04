import { useState, useEffect } from "react";

export interface Requester {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

interface RequesterSelectionProps {
  onSelect: (requesterId: number) => void;
}

export default function RequesterSelection({ onSelect }: RequesterSelectionProps) {
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    const fetchRequesters = async () => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/requesters");
        if (!res.ok) throw new Error("Failed to fetch requesters");
        const data = await res.json();
        setRequesters(data);
        if (data.length > 0) {
          setSelectedId(String(data[0].id));
        }
      } catch (err) {
        setError("Unable to load Development Requesters. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequesters();
  }, []);

  const handleContinue = () => {
    if (selectedId) {
      onSelect(Number(selectedId));
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column justify-content-center align-items-center p-4" style={{ backgroundColor: "#F5F7F6" }}>
      <div className="card shadow-sm border-0 rounded-3 p-4 p-md-5 max-w-500 w-100 bg-white">
        
        <div className="text-center mb-4">
          <h1 className="fw-bold display-6" style={{ color: "#006B3C" }}>TokTickIT</h1>
          <h2 className="h4 fw-bold mt-3" style={{ color: "#0B7A46" }}>Select Development Requester</h2>
          <p className="text-secondary small mt-2">
            Select a Development Requester to test requester-specific ticket behavior. 
            This is not a login screen. Authentication and role-based access will be introduced in Lab 3.
          </p>
        </div>

        {isLoading && (
          <div className="text-center text-secondary py-4" data-testid="loading-state">
            Loading Requesters...
          </div>
        )}

        {error && (
          <div className="alert alert-danger shadow-sm rounded-3 py-3" role="alert" data-testid="error-state">
            <div className="fw-bold mb-1">System Error</div>
            <div>{error}</div>
          </div>
        )}

        {!isLoading && !error && requesters.length === 0 && (
          <div className="alert alert-warning shadow-sm rounded-3 py-3" role="alert" data-testid="empty-state">
            <div className="fw-bold mb-1">No Active Requesters</div>
            <div>There are no active Development Requesters available in the system.</div>
          </div>
        )}

        {!isLoading && !error && requesters.length > 0 && (
          <div className="mt-2" data-testid="success-state">
            <label htmlFor="requester-select" className="form-label fw-bold" style={{ color: "#2c3e50" }}>
              Development Requester <span className="text-danger">*</span>
            </label>
            <select
              id="requester-select"
              className="form-select form-select-lg mb-2"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {requesters.map((req) => (
                <span key={req.id}>
                   <option value={req.id}>{req.name}</option>
                </span>
              ))}
            </select>
            
            <div className="d-flex align-items-center text-muted small mb-4 p-2 rounded" style={{ backgroundColor: "#EAF6EF" }}>
              <span className="me-2">ℹ️</span> Only active development requesters are shown
            </div>

            <div className="alert alert-secondary d-flex align-items-start border-0" style={{ backgroundColor: "#f8f9fa" }}>
              <span className="me-2 fs-5">🛡️</span>
              <div>
                <strong className="d-block small text-dark">Authentication coming in Lab 3</strong>
                <span className="small text-muted">In Lab 3, this selection will be replaced with secure authentication so you can access the system with your own account.</span>
              </div>
            </div>

            <div className="d-flex justify-content-end mt-4 gap-2">
              <button 
                type="button" 
                className="btn btn-light border px-4 fw-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn text-white px-4 fw-bold"
                style={{ backgroundColor: "#006B3C" }}
                onClick={handleContinue}
                disabled={!selectedId}
              >
                → Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}