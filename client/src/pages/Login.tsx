import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { LogIn, Eye, EyeOff, Home, ChevronRight } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import TextInput from "../components/TextInput";
import type { AuthUser } from "../api.js";

// Role home (ui-spec §3): Requester → My Tickets; IT Staff/Admin → Ticket Queue.
export function roleHome(user: AuthUser): string {
  return user.role === "REQUESTER" ? "/my-tickets" : "/queue";
}

function safeMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Invalid email or password.";
}

export default function Login() {
  const { user, isLoading: authLoading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!authLoading && user) {
    // Already signed in (session restore) — skip straight on.
    const target = user.mustChangePassword ? "/change-password" : roleHome(user);
    return <Navigate to={target} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) errors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = "Enter a valid email address.";
    if (!password) errors.password = "Password is required.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    setBanner(null);
    try {
      const signedIn = await login(email.trim(), password);
      const redirectParam = new URLSearchParams(location.search).get("redirect");
      const redirect =
        redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
          ? redirectParam
          : null;
      if (signedIn.mustChangePassword) {
        navigate("/change-password", { replace: true });
      } else {
        navigate(redirect ?? roleHome(signedIn), { replace: true });
      }
    } catch (err) {
      // Single safe banner for any 401 (BR-02 leaks nothing).
      setBanner(safeMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ backgroundColor: "#F5F7F6" }}>
      <div className="container mt-4 mb-2 d-flex align-items-center text-muted small fw-medium">
        <Link to="/" aria-label="Go to home">
          <Home size={16} className="me-1" style={{ color: "#006B3C" }} />
        </Link>
        <ChevronRight size={14} className="mx-1" />
        <span style={{ color: "#006B3C" }}>Log in</span>
      </div>

      <div className="d-flex flex-column justify-content-center align-items-center p-4 flex-grow-1">
        <div className="card shadow-sm border-0 rounded-3 p-4 p-md-5 w-100 bg-white" style={{ maxWidth: "480px" }}>
          <div className="text-center mb-4">
            <div
              className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
              style={{ width: "64px", height: "64px", backgroundColor: "#EAF6EF" }}
            >
              <LogIn size={32} style={{ color: "#006B3C" }} />
            </div>
            <h2 className="h4 fw-bold text-dark mb-2">Log in to TokTikIT</h2>
            <p className="text-muted small px-3">Use your account email and password.</p>
          </div>

          {banner && (
            <div className="alert alert-danger py-2 small" role="alert" data-testid="login-error">
              {banner}
            </div>
          )}

          <form onSubmit={handleSubmit} data-testid="login-form" noValidate>
            <div className="mb-3">
              <TextInput
                label="Email"
                type="email"
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldErrors.email ?? false}
                required
                data-testid="login-email"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="login-password" className="form-label fw-bold small text-dark">
                Password <span className="text-danger">*</span>
              </label>
              <div className="input-group">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className={`form-control${fieldErrors.password ? " is-invalid" : ""}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="login-password"
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                {fieldErrors.password && <div className="invalid-feedback">{fieldErrors.password}</div>}
              </div>
            </div>

            <button
              type="submit"
              className="btn text-white w-100 fw-medium py-2"
              style={{ backgroundColor: "#006B3C" }}
              disabled={isSubmitting || authLoading}
              data-testid="login-submit"
            >
              {isSubmitting ? "Logging in…" : "Log in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
