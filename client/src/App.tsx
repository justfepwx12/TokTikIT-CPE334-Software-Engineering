import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { checkSystem, type Category } from "./api.js";
import Header from "./components/Header";
import { RequesterProvider, useRequester } from "./context/RequesterContext";
import RequesterSelection from "./pages/RequesterSelection.js";

import "./App.css";

function SystemStatusHome() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleCheckSystem = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const status = await checkSystem();
      setIsOnline(status.online);
      setCategories(status.categories);
    } catch (err) {
      setIsOnline(false);
      setError("Unable to connect to TokTickIT API");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleCheckSystem();
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

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="text-center p-5">
      <h2 className="fw-bold text-brand">{title}</h2>
      <p className="text-secondary">This screen isn't implemented yet.</p>
    </div>
  );
}

// ป้องกัน Route: เด้งกลับไปหน้าเลือก Requester ทันทีถ้ายังไม่มี (FR-03)
function ProtectedRoute({ children }: { children: React.JSX.Element }) {
  const { requester, isLoading } = useRequester();
  
  if (isLoading) return null;
  
  if (!requester) {
    return <Navigate to="/select-requester" replace />;
  }
  return children;
}

function App() {
  return (
    <RequesterProvider>
      <Header />
      <Routes>
        <Route path="/" element={<SystemStatusHome />} />
        <Route path="/select-requester" element={<RequesterSelection />} />
        
        <Route path="/my-tickets" element={
          <ProtectedRoute>
            <ComingSoon title="My Tickets" />
          </ProtectedRoute>
        } />
        <Route path="/create-ticket" element={
          <ProtectedRoute>
            <ComingSoon title="Create Ticket" />
          </ProtectedRoute>
        } />
      </Routes>
    </RequesterProvider>
  );
}

export default App;