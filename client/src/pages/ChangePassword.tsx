import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import TextInput from "../components/TextInput";
import { roleHome } from "../utils/roleHome.js";

// Mandatory first-login password change (ui-spec §4, BR-03). No cancel —
// header Logout is the only exit. Server validation is authoritative.
export default function ChangePassword() {
  const { user, isLoading: authLoading, changePassword } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (authLoading) return null;
  if (!user) return <Navigate to="/login?redirect=/change-password" replace />;
  if (!user.mustChangePassword) return <Navigate to={roleHome(user)} replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errors: { current?: string; next?: string; confirm?: string } = {};
    if (!currentPassword) errors.current = "Current password is required.";
    if (newPassword.trim().length < 8) errors.next = "New password must be at least 8 characters.";
    if (newPassword === currentPassword && newPassword) errors.next = "New password must be different.";
    if (confirmPassword !== newPassword) errors.confirm = "Passwords do not match.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    setBanner(null);
    try {
      await changePassword(currentPassword, newPassword);
      navigate(roleHome(user), { replace: true });
    } catch (err) {
      setBanner(err instanceof Error && err.message ? err.message : "Could not change the password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ backgroundColor: "#F5F7F6" }}>
      <div className="d-flex flex-column justify-content-center align-items-center p-4 flex-grow-1">
        <div className="card shadow-sm border-0 rounded-3 p-4 p-md-5 w-100 bg-white" style={{ maxWidth: "480px" }}>
          <div className="text-center mb-4">
            <div
              className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
              style={{ width: "64px", height: "64px", backgroundColor: "#EAF6EF" }}
            >
              <KeyRound size={32} style={{ color: "#006B3C" }} />
            </div>
            <h2 className="h4 fw-bold text-dark mb-2">Set a new password</h2>
            <p className="text-muted small px-3">
              You are using a temporary password and must set a new one before continuing.
            </p>
          </div>

          {banner && (
            <div className="alert alert-danger py-2 small" role="alert" data-testid="change-password-error">
              {banner}
            </div>
          )}

          <form onSubmit={handleSubmit} data-testid="change-password-form" noValidate>
            <div className="mb-3">
              <TextInput
                label="Current password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                error={fieldErrors.current ?? false}
                required
                data-testid="change-current"
              />
            </div>
            <div className="mb-3">
              <TextInput
                label="New password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                error={fieldErrors.next ?? false}
                required
                data-testid="change-new"
              />
            </div>
            <div className="mb-4">
              <TextInput
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={fieldErrors.confirm ?? false}
                required
                data-testid="change-confirm"
              />
            </div>

            <button
              type="submit"
              className="btn text-white w-100 fw-medium py-2"
              style={{ backgroundColor: "#006B3C" }}
              disabled={isSubmitting}
              data-testid="change-submit"
            >
              {isSubmitting ? "Saving…" : "Set new password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
