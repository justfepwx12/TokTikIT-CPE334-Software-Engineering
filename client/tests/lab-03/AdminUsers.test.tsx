/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import * as api from "../../src/api";
import UserManagement from "../../src/pages/UserManagement";
import { AuthProvider } from "../../src/context/AuthContext";

const ADMIN: api.AuthUser = {
  id: 1,
  name: "Admin One",
  email: "admin@toktikit.com",
  role: "ADMIN",
  isActive: true,
  mustChangePassword: false,
};

const USERS: api.AdminUser[] = [
  { id: 1, name: "Admin One", email: "admin@toktikit.com", role: "ADMIN", isActive: true, mustChangePassword: false, createdAt: "2026-09-14T04:00:00.000Z" },
  { id: 2, name: "Jane Doe", email: "jane@toktikit.com", role: "REQUESTER", isActive: true, mustChangePassword: false, createdAt: "2026-09-14T04:00:00.000Z" },
];

function renderPage() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <UserManagement />
      </AuthProvider>
    </BrowserRouter>
  );
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.spyOn(api, "getSessionUser").mockResolvedValue({ user: ADMIN });
  vi.spyOn(api, "getAdminUsers").mockResolvedValue({ users: USERS });
});

afterEach(() => {
  cleanup();
});

describe("Lab 3 UserManagement (AC-26)", () => {
  it("renders the user table with search and role filter", async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId("user-row")).toHaveLength(2));

    expect(screen.getByTestId("user-search")).toBeDefined();
    expect(screen.getByTestId("user-role-filter")).toBeDefined();
    expect(screen.getByText("Admin One")).toBeDefined();
    expect(screen.getByText("jane@toktikit.com")).toBeDefined();
    expect(screen.getAllByText("Active").length).toBeGreaterThanOrEqual(2);
  });

  it("sends search and role filter parameters to the API", async () => {
    renderPage();
    await waitFor(() => expect(api.getAdminUsers).toHaveBeenCalledWith({}));

    fireEvent.change(screen.getByTestId("user-role-filter"), { target: { value: "REQUESTER" } });
    await waitFor(() =>
      expect(api.getAdminUsers).toHaveBeenCalledWith({ search: undefined, role: "REQUESTER" })
    );
  });

  it("creates a user through the modal (AC-26)", async () => {
    const createMock = vi.spyOn(api, "createAdminUser").mockResolvedValue({
      user: { id: 3, name: "Newbie", email: "newbie@toktikit.com", role: "IT_STAFF", isActive: true, mustChangePassword: true, createdAt: "2026-09-14T04:00:00.000Z" },
    });
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId("user-row")).toHaveLength(2));

    fireEvent.click(screen.getByTestId("user-create-open"));
    fireEvent.change(screen.getByTestId("user-form-name"), { target: { value: "Newbie" } });
    fireEvent.change(screen.getByTestId("user-form-email"), { target: { value: "newbie@toktikit.com" } });
    fireEvent.change(screen.getByTestId("user-form-role"), { target: { value: "IT_STAFF" } });
    fireEvent.change(screen.getByTestId("user-form-password"), { target: { value: "TempPass123!" } });
    fireEvent.click(screen.getByTestId("user-form-save"));

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith({
        name: "Newbie",
        email: "newbie@toktikit.com",
        role: "IT_STAFF",
        password: "TempPass123!",
        isActive: true,
      })
    );
    await waitFor(() => expect(screen.getByText("Newbie")).toBeDefined());
  });

  it("shows duplicate-email feedback against the email field (AC-27)", async () => {
    vi.spyOn(api, "createAdminUser").mockRejectedValue(new Error("A user with this email already exists."));
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId("user-row")).toHaveLength(2));

    fireEvent.click(screen.getByTestId("user-create-open"));
    fireEvent.change(screen.getByTestId("user-form-name"), { target: { value: "Dupe" } });
    fireEvent.change(screen.getByTestId("user-form-email"), { target: { value: "jane@toktikit.com" } });
    fireEvent.change(screen.getByTestId("user-form-password"), { target: { value: "TempPass123!" } });
    fireEvent.click(screen.getByTestId("user-form-save"));

    expect(await screen.findByText("A user with this email already exists.")).toBeDefined();
  });

  it("surfaces safety-guard feedback when saving is rejected (AC-28/29)", async () => {
    vi.spyOn(api, "updateAdminUser").mockRejectedValue(new Error("You cannot deactivate your own account."));
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId("user-row")).toHaveLength(2));

    fireEvent.click(screen.getByTestId("user-edit-1"));
    fireEvent.click(screen.getByTestId("user-form-save"));

    expect(await screen.findByTestId("user-form-banner")).toBeDefined();
    expect(screen.getByText("You cannot deactivate your own account.")).toBeDefined();
  });

  it("resets a password and marks must-change (AC-26)", async () => {
    const resetMock = vi.spyOn(api, "resetAdminPassword").mockResolvedValue({ message: "ok" });
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId("user-row")).toHaveLength(2));

    fireEvent.click(screen.getByTestId("user-reset-2"));
    fireEvent.change(screen.getByTestId("reset-password-input"), { target: { value: "ResetTemp123!" } });
    fireEvent.click(screen.getByTestId("reset-submit"));

    await waitFor(() => expect(resetMock).toHaveBeenCalledWith(2, "ResetTemp123!"));
    expect(await screen.findByTestId("reset-success")).toBeDefined();
  });

  it("exposes no delete control anywhere (BR-12, AC-31)", async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId("user-row")).toHaveLength(2));

    expect(screen.queryByRole("button", { name: /^delete$/i })).toBeNull();
    expect(screen.queryByTestId(/user-delete/i)).toBeNull();
  });
});
