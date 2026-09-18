import { useState, useEffect } from "react";import {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  resetAdminPassword,
  type AdminUser,
  type UserRole,
} from "../api.js";
import { useAuth } from "../hooks/useAuth";
import Badge from "../components/Badge";
import Button from "../components/Button";
import TextInput from "../components/TextInput";

const ROLES: UserRole[] = ["REQUESTER", "IT_STAFF", "ADMIN"];

function roleLabel(role: UserRole): string {
  if (role === "IT_STAFF") return "IT Staff";
  return role.charAt(0) + role.slice(1).toLowerCase();
}

interface UserForm {
  name: string;
  email: string;
  role: UserRole;
  password: string;
  isActive: boolean;
}

const EMPTY_FORM: UserForm = { name: "", email: "", role: "REQUESTER", password: "", isActive: true };

function validateForm(form: UserForm, isCreate: boolean): Partial<Record<keyof UserForm, string>> {
  const errors: Partial<Record<keyof UserForm, string>> = {};
  if (form.name.trim().length < 2 || form.name.trim().length > 100) {
    errors.name = "Name must be between 2 and 100 characters.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!ROLES.includes(form.role)) errors.role = "Select exactly one role.";
  if (isCreate && (form.password.trim().length < 8 || form.password.trim().length > 128)) {
    errors.password = "Initial password must be between 8 and 128 characters.";
  }
  return errors;
}

export default function UserManagement() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState<string | undefined>(undefined);
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");

  const [modal, setModal] = useState<null | { mode: "create" } | { mode: "edit"; user: AdminUser }>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof UserForm, string>>>({});
  const [formBanner, setFormBanner] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Esc closes any open modal (carried a11y pattern).
  useEffect(() => {
    if (!modal && !resetTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!isSaving) setModal(null);
        if (!isResetting) setResetTarget(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal, resetTarget, isSaving, isResetting]);

  // Debounced search (ui-spec §8): typing refetches without a submit click.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(draftSearch.trim() || undefined);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draftSearch]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getAdminUsers({ search, role: roleFilter || undefined });
        if (cancelled) return;
        setUsers(res.users);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load users.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [search, roleFilter, retryKey]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormBanner(null);
    setModal({ mode: "create" });
  };

  const openEdit = (user: AdminUser) => {
    setForm({ name: user.name, email: user.email, role: user.role, password: "", isActive: user.isActive });
    setFieldErrors({});
    setFormBanner(null);
    setModal({ mode: "edit", user });
  };

  const closeModal = () => {
    if (isSaving) return;
    setModal(null);
  };

  const handleSave = async () => {
    if (!modal) return;
    const isCreate = modal.mode === "create";
    const errors = validateForm(form, isCreate);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    setFormBanner(null);
    try {
      if (isCreate) {
        const created = await createAdminUser({
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          password: form.password,
          isActive: form.isActive,
        });
        setUsers((prev) => [created.user, ...prev]);
      } else {
        const target = modal.user;
        const updated = await updateAdminUser(target.id, {
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          isActive: form.isActive,
        });
        setUsers((prev) => prev.map((u) => (u.id === target.id ? updated.user : u)));
      }
      setModal(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save the user.";
      // Safety-guard and duplicate feedback surfaces against the form.
      if (/already exists/i.test(message)) {
        setFieldErrors((prev) => ({ ...prev, email: message }));
      } else {
        setFormBanner(message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const openReset = (user: AdminUser) => {
    setResetTarget(user);
    setResetPassword("");
    setResetError(null);
    setResetSuccess(null);
  };

  const handleReset = async () => {
    if (!resetTarget) return;
    if (resetPassword.trim().length < 8 || resetPassword.trim().length > 128) {
      setResetError("Temporary password must be between 8 and 128 characters.");
      return;
    }
    setIsResetting(true);
    setResetError(null);
    try {
      await resetAdminPassword(resetTarget.id, resetPassword);
      setUsers((prev) =>
        prev.map((u) => (u.id === resetTarget.id ? { ...u, mustChangePassword: true } : u))
      );
      setResetSuccess("Password reset. User must change it on next login.");
      setResetPassword("");
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Could not reset the password.");
    } finally {
      setIsResetting(false);
    }
  };

  const hasActiveFilters = Boolean(search || roleFilter);

  return (
    <div className="container py-4" style={{ maxWidth: "1100px" }} data-testid="user-management">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h2 className="h4 fw-bold text-dark mb-0">User Management</h2>
          <p className="text-secondary small mb-0">Admin only · deactivation retires accounts, nothing is ever deleted</p>
        </div>
        <Button type="button" onClick={openCreate} data-testid="user-create-open">
          Create User
        </Button>
      </div>

      <div className="card shadow-sm border-0 rounded-3 p-3 mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-12 col-md-6">
            <TextInput
              label="Search"
              data-testid="user-search"
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              placeholder="Search name or email…"
            />
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label fw-bold small text-dark" htmlFor="user-role-filter">
              Role
            </label>
            <select
              id="user-role-filter"
              data-testid="user-role-filter"
              className="form-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole | "")}
            >
              <option value="">All roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isLoading && (
        <div data-testid="users-loading" className="text-center py-5 text-secondary">
          Loading users…
        </div>
      )}

      {!isLoading && error && (
        <div data-testid="users-error" role="alert" className="alert alert-danger d-flex justify-content-between align-items-center py-3">
          <span>{error}</span>
          <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !error && users.length === 0 && (
        <div data-testid={hasActiveFilters ? "users-no-results" : "users-empty"} className="text-center py-5">
          <h5 className="fw-bold text-dark mb-1">{hasActiveFilters ? "No matching users" : "No users yet"}</h5>
          <p className="text-secondary small mb-0">
            {hasActiveFilters ? "No users match your current search or filter." : "Create the first account to get started."}
          </p>
        </div>
      )}

      {!isLoading && !error && users.length > 0 && (
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 table-stable" data-testid="users-table">
            <colgroup>
              <col style={{ width: "180px" }} />
              <col />
              <col style={{ width: "110px" }} />
              <col style={{ width: "100px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "210px" }} />
            </colgroup>
            <thead className="table-light">
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Password</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} data-testid="user-row">
                  <td className="fw-semibold text-dark" title={u.name}>
                    {u.name}
                    {me?.id === u.id && <span className="text-secondary small"> (you)</span>}
                  </td>
                  <td className="small" title={u.email}>{u.email}</td>
                  <td>
                    <Badge color={u.role === "ADMIN" ? "yellow" : u.role === "IT_STAFF" ? "blue" : "green"}>
                      {roleLabel(u.role)}
                    </Badge>
                  </td>
                  <td>
                    <Badge color={u.isActive ? "green" : "gray"}>{u.isActive ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td>
                    {u.mustChangePassword ? (
                      <span className="badge text-dark border" data-testid={`must-change-${u.id}`}>
                        Must change
                      </span>
                    ) : (
                      <span className="text-secondary small">—</span>
                    )}
                  </td>
                  <td>
                    <div className="d-flex flex-wrap gap-1">
                      <Button variant="secondary" type="button" data-testid={`user-edit-${u.id}`} onClick={() => openEdit(u)}>
                        Edit
                      </Button>
                      <Button variant="secondary" type="button" data-testid={`user-reset-${u.id}`} onClick={() => openReset(u)}>
                        Reset password
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div
          className="modal d-block"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={modal.mode === "create" ? "Create user" : "Edit user"}
          data-testid="user-modal"
          style={{ position: "fixed", inset: 0, zIndex: 1055, backgroundColor: "rgba(0,0,0,0.5)", overflowY: "auto", padding: "1rem" }}
          onClick={closeModal}
        >
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ margin: "2rem auto", maxWidth: "520px" }}
          >
            <div className="modal-content p-4">
              <h3 className="h5 fw-bold text-dark mb-3">
                {modal.mode === "create" ? "Create user" : `Edit user`}
              </h3>
              {formBanner && (
                <div data-testid="user-form-banner" role="alert" className="alert alert-danger py-2 small">
                  {formBanner}
                </div>
              )}
              <div className="mb-3">
                <TextInput
                  label="Name"
                  data-testid="user-form-name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  error={fieldErrors.name ?? false}
                  required
                />
              </div>
              <div className="mb-3">
                <TextInput
                  label="Email"
                  type="email"
                  data-testid="user-form-email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  error={fieldErrors.email ?? false}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label fw-bold small text-dark" htmlFor="user-form-role">
                  Role
                </label>
                <select
                  id="user-form-role"
                  data-testid="user-form-role"
                  className="form-select"
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as UserRole }))}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </div>
              {modal.mode === "create" && (
                <div className="mb-3">
                  <TextInput
                    label="Initial password"
                    type="password"
                    autoComplete="new-password"
                    data-testid="user-form-password"
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    error={fieldErrors.password ?? false}
                    required
                  />
                  <div className="form-text small">The user must change it at first login.</div>
                </div>
              )}
              <div className="form-check mb-3">
                <input
                  id="user-form-active"
                  data-testid="user-form-active"
                  className="form-check-input"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                />
                <label className="form-check-label small fw-bold" htmlFor="user-form-active">
                  Active account
                </label>
              </div>
              <div className="d-flex justify-content-end gap-2">
                <Button variant="secondary" type="button" onClick={closeModal} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="button" data-testid="user-form-save" onClick={() => void handleSave()} disabled={isSaving}>
                  {isSaving ? "Saving…" : modal.mode === "create" ? "Create" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {resetTarget && (
        <div
          className="modal d-block"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Reset password"
          data-testid="reset-modal"
          style={{ position: "fixed", inset: 0, zIndex: 1055, backgroundColor: "rgba(0,0,0,0.5)", overflowY: "auto", padding: "1rem" }}
          onClick={() => {
            if (!isResetting) setResetTarget(null);
          }}
        >
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ margin: "2rem auto", maxWidth: "480px" }}
          >
            <div className="modal-content p-4">
              <h3 className="h5 fw-bold text-dark mb-1">Reset password</h3>
              <p className="text-secondary small mb-3">
                {resetTarget.name} ({resetTarget.email})
              </p>
              {resetSuccess ? (
                <div data-testid="reset-success" role="status" className="alert alert-success py-2 small">
                  {resetSuccess}
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <TextInput
                      label="Temporary password"
                      type="password"
                      autoComplete="new-password"
                      data-testid="reset-password-input"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      error={resetError ?? false}
                      required
                    />
                    <div className="form-text small">The user must change it at next login.</div>
                  </div>
                  <div className="d-flex justify-content-end gap-2">
                    <Button variant="secondary" type="button" onClick={() => setResetTarget(null)} disabled={isResetting}>
                      Cancel
                    </Button>
                    <Button type="button" data-testid="reset-submit" onClick={() => void handleReset()} disabled={isResetting}>
                      {isResetting ? "Resetting…" : "Reset"}
                    </Button>
                  </div>
                </>
              )}
              {resetSuccess && (
                <div className="d-flex justify-content-end">
                  <Button variant="secondary" type="button" onClick={() => setResetTarget(null)}>
                    Close
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
