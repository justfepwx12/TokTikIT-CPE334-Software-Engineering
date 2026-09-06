import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { UserCog, Info, Shield, Home, ChevronRight } from 'lucide-react';
import { useRequester } from "../hooks/useRequester";

export interface Requester {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

export default function RequesterSelection() {
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");

  const { setRequester } = useRequester();
  const navigate = useNavigate();
  const location = useLocation();

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
      } catch {
        setError("Unable to load Development Requesters. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequesters();
  }, []);

  const handleContinue = () => {
    const selected = requesters.find(r => String(r.id) === selectedId);
    if (selected) {
      // เซฟข้อมูลลง Context
      setRequester({ id: selected.id, name: selected.name });
      // กลับไปหน้าที่ผู้ใช้ตั้งใจไว้ (จาก query param) หรือหน้าแรก
      const redirectParam = new URLSearchParams(location.search).get("redirect") ?? "/";
      const target = redirectParam.startsWith("/") && !redirectParam.startsWith("//")
        ? redirectParam
        : "/";
      navigate(target);
    }
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column" style={{ backgroundColor: '#F5F7F6' }}>
      {/* Breadcrumb Navigation */}
      <div className="container mt-4 mb-2 d-flex align-items-center text-muted small fw-medium">
        <Link to="/" aria-label="Go to home">
          <Home size={16} className="me-1" style={{ color: '#006B3C' }} />
        </Link>
        <ChevronRight size={14} className="mx-1" />
        <span style={{ color: '#006B3C' }}>Development Requester Selection</span>
      </div>

      {/* Main Container */}
      <div className="d-flex flex-column justify-content-center align-items-center p-4 flex-grow-1">
        <div className="card shadow-sm border-0 rounded-3 p-4 p-md-5 w-100 bg-white" style={{ maxWidth: '650px' }}>
          
          {/* Header Section */}
          <div className="text-center mb-4">
            <div 
              className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
              style={{ width: '64px', height: '64px', backgroundColor: '#EAF6EF' }}
            >
              <UserCog size={32} style={{ color: '#006B3C' }} />
            </div>
            <h2 className="h4 fw-bold text-dark mb-2">Select Development Requester</h2>
            <p className="text-muted small px-3">
              Select a Development Requester to test requester-specific ticket behavior. This is not a login screen.
            </p>
          </div>

          <hr className="text-muted opacity-25 mb-4" />

          {/* Dynamic States (Loading, Error, Empty) */}
          {isLoading && <div data-testid="loading-state">Checking system...</div>}
          {error && <div data-testid="error-state" className="text-danger">{error}</div>}
          {!isLoading && !error && requesters.length === 0 && (
            <div data-testid="empty-state">No active development requesters found.</div>
          )}

          {/* Content Section (Success State) */}
          {!isLoading && !error && requesters.length > 0 && (
            <div data-testid="success-state">
              <label className="form-label fw-bold small text-dark" htmlFor="requester-select">
                Development Requester <span className="text-danger">*</span>
              </label>
              
              <select 
                className="form-select mb-3" 
                id="requester-select"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="" disabled>-- Select Requester --</option>
                {requesters.map((req) => (
                  <option key={req.id} value={req.id}>{req.name}</option>
                ))}
              </select>

              {/* Info Box */}
              <div className="d-flex align-items-center p-3 mb-3 rounded" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534' }}>
                <Info size={20} className="me-3 flex-shrink-0" />
                <span className="small fw-medium">Only active development requesters are shown.</span>
              </div>

              {/* Shield Box */}
              <div className="d-flex align-items-start p-3 mb-4 rounded bg-light border">
                <Shield size={24} className="me-3 text-secondary flex-shrink-0 mt-1" />
                <div>
                  <strong className="d-block text-dark mb-1" style={{ fontSize: '0.9rem' }}>
                    Authentication coming in Lab 3
                  </strong>
                  <span className="small text-muted">
                    In Lab 3, this selection will be replaced with secure authentication so you can access the system with your own account.
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="d-flex justify-content-end gap-3 mt-2">
                <button type="button" className="btn btn-light border px-4 fw-medium text-dark" onClick={() => navigate('/')}>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn text-white px-4 fw-medium d-flex align-items-center gap-2"
                  style={{ backgroundColor: '#006B3C' }}
                  onClick={handleContinue}
                  disabled={!selectedId}
                >
                  <span>&rarr;</span> Continue
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}