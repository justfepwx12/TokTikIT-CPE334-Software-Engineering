import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { checkSystem, type Category } from "./api.js";
import Header from "./components/Header";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./hooks/useAuth";
import MyTickets from "./pages/MyTickets";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import CreateTicket from "./pages/CreateTicket";
import TicketDetail from "./pages/TicketDetail";

import "./App.css";

function SystemStatusHome() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runCheck = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const status = await checkSystem();
      setIsOnline(status.online);
      setCategories(status.categories);
    } catch {
      setIsOnline(false);
      setError("Unable to connect to TokTickIT API");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckSystem = () => {
    void runCheck();
  };

  useEffect(() => {
    let cancelled = false;

    const initialCheck = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setIsLoading(true);
      setError(null);
      try {
        const status = await checkSystem();
        if (cancelled) return;
        setIsOnline(status.online);
        setCategories(status.categories);
      } catch {
        if (cancelled) return;
        setIsOnline(false);
        setError("Unable to connect to TokTickIT API");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    initialCheck();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-vh-100 bg-white d-flex flex-column justify-content-center align-items-center text-center p-4">
      <h1 className="fw-bold mb-4 display-3 text-brand">TokTickIT</h1>

      {isLoading && <div className="text-secondary mb-3">Checking system...</div>}

      {isOnline === false && (
        <div className="alert alert-danger shadow-sm rounded-3 px-4 py-3 mb-4 max-w-400" role="alert">
          <div className="fw-bold mb-1">System Status: Offline</div>
          <div>{error || "Unable to connect to TokTickIT API"}</div>
        </div>
      )}

      {isOnline === true && (
        <div className="alert alert-backend-success shadow-sm rounded-3 px-4 py-3 mb-4 max-w-400" role="alert">
          <div className="fw-bold mb-1">System Status: Online</div>
        </div>
      )}

      {isOnline === true && categories.length > 0 && (
        <div className="w-100 my-4 max-w-500">
          <h3 className="fw-bold mb-3 text-brand">Supported Request Categories</h3>
          <ul className="list-group shadow-sm rounded-3 text-start">
            {categories.map((cat) => (
              <li key={cat.id} className="list-group-item d-flex justify-content-between align-items-center py-3">
                <span className="fw-medium">{cat.name}</span>
                <span className="badge bg-brand rounded-pill px-3 py-2">ID: {cat.id}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={handleCheckSystem}
        disabled={isLoading}
        className="btn btn-brand btn-lg px-5 py-3 fw-bold shadow-sm rounded-3 mt-2"
      >
        {isLoading ? "CHECKING..." : "Check System"}
      </button>
    </div>
  );
}

// Auth guard: no session → /login; mustChangePassword → /change-password
// (BR-03 — cannot be routed around). Mirrors the server gate.
function ProtectedRoute({ children }: { children: React.JSX.Element }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return null;

  if (!user) {
    const redirect = encodeURIComponent(location.pathname);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  if (user.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  return children;
}

function App() {
  return (
    <AuthProvider>
      <Header />
      <Routes>
        <Route path="/" element={<SystemStatusHome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/my-tickets" element={
          <ProtectedRoute>
            <MyTickets />
          </ProtectedRoute>
        } />
        <Route path="/create-ticket" element={
          <ProtectedRoute>
            <CreateTicket />
          </ProtectedRoute>
        } />
        <Route path="/tickets/:id" element={
          <ProtectedRoute>
            <TicketDetail />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;