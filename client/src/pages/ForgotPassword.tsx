import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import TextInput from "../components/TextInput";
import { roleHome } from "../utils/navigation.js";

// Password resets are administrator-mediated (AD-09 — this system sends no
// email). The form collects the account email and directs the user to their
// IT administrator, who performs the reset via the admin console (AC-26).
// The confirmation is identical whether or not the email exists so the page
// leaks nothing about accounts (BR-02).
export default function ForgotPassword() {
  const { user, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | false>(false);
  const [submitted, setSubmitted] = useState(false);

  if (!authLoading && user) {
    const target = user.mustChangePassword ? "/change-password" : roleHome(user);
    return <Navigate to={target} replace />;
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setFieldError("Email is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldError("Enter a valid email address.");
      return;
    }
    setFieldError(false);
    setSubmitted(true);
  };

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ backgroundColor: "#F5F7F6" }}>
      <div className="d-flex flex-column justify-content-center align-items-center p-4 flex-grow-1">
        <div className="card shadow-sm border-0 rounded-3 p-4 p-md-5 w-100 bg-white" style={{ maxWidth: "480px" }}>
          <div className="text-center mb-4">
            <h2 className="h4 fw-bold text-dark mb-2">Forgot your password?</h2>
            <p className="text-muted small px-3">
              Enter your account email. Your IT administrator will reset your password for you.
            </p>
          </div>

          {submitted ? (
            <div className="alert alert-success py-2 small" role="status" data-testid="forgot-success">
              If this email is registered, your administrator can now reset the password. Please contact
              your IT administrator to request the reset — you will set a new password at your next
              log in.
            </div>
          ) : (
            <form onSubmit={handleSubmit} data-testid="forgot-form" noValidate>
              <div className="mb-4">
                <TextInput
                  label="Email"
                  type="email"
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={fieldError}
                  required
                  data-testid="forgot-email"
                />
              </div>

              <button
                type="submit"
                className="btn text-white w-100 fw-medium py-2"
                style={{ backgroundColor: "#006B3C" }}
                disabled={authLoading}
                data-testid="forgot-submit"
              >
                Request password reset
              </button>
            </form>
          )}

          <div className="text-center mt-3">
            <Link
              to="/login"
              className="small fw-medium text-decoration-none"
              style={{ color: "#006B3C" }}
              data-testid="forgot-back"
            >
              Back to log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
