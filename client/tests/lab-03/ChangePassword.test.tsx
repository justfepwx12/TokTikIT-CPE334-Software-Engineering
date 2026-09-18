/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import ChangePassword from "../../src/pages/ChangePassword";
import * as api from "../../src/api";
import { AuthProvider } from "../../src/context/AuthContext";

vi.mock("lucide-react", () => {
  const stub = () => null;
  return { KeyRound: stub };
});

const MUST_CHANGE: api.AuthUser = {
  id: 2, name: "Jane Doe", email: "jane@toktikit.com", role: "REQUESTER",
  isActive: true, mustChangePassword: true,
};
const CLEAR: api.AuthUser = { ...MUST_CHANGE, mustChangePassword: false };

function Probe() {
  const location = useLocation();
  return <div data-testid="probe-path">{location.pathname}</div>;
}

function renderPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/change-password"]}>
        <Routes>
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/my-tickets" element={<Probe />} />
          <Route path="/login" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.spyOn(api, "getSessionUser").mockResolvedValue({ user: MUST_CHANGE });
});

afterEach(() => {
  cleanup();
});

describe("Lab 3 ChangePassword (AC-06/07)", () => {
  it("renders the mandatory form with no cancel path", async () => {
    renderPage();
    expect(await screen.findByTestId("change-password-form")).toBeDefined();
    expect(screen.getByTestId("change-current")).toBeDefined();
    expect(screen.getByTestId("change-new")).toBeDefined();
    expect(screen.getByTestId("change-confirm")).toBeDefined();
    expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();
  });

  it("redirects away when no change is required", async () => {
    vi.spyOn(api, "getSessionUser").mockResolvedValue({ user: CLEAR });
    renderPage();
    await waitFor(() => expect(screen.getByTestId("probe-path")).toBeDefined());
    expect(screen.getByTestId("probe-path").textContent).toBe("/my-tickets");
  });

  it("rejects mismatched confirmation without calling the API", async () => {
    const changeMock = vi.spyOn(api, "changePassword");
    renderPage();
    await waitFor(() => expect(screen.getByTestId("change-password-form")).toBeDefined());

    fireEvent.change(screen.getByTestId("change-current"), { target: { value: "OldPass123!" } });
    fireEvent.change(screen.getByTestId("change-new"), { target: { value: "NewPass123!" } });
    fireEvent.change(screen.getByTestId("change-confirm"), { target: { value: "TypoPass123!" } });
    fireEvent.click(screen.getByTestId("change-submit"));

    expect(await screen.findByText("Passwords do not match.")).toBeDefined();
    expect(changeMock).not.toHaveBeenCalled();
  });

  it("clears the gate and lands on role home after a valid change", async () => {
    // AuthProvider refreshes the session after changePassword resolves.
    vi.spyOn(api, "changePassword").mockResolvedValue({ message: "Password changed." });
    vi.spyOn(api, "getSessionUser")
      .mockResolvedValueOnce({ user: MUST_CHANGE })
      .mockResolvedValue({ user: CLEAR });
    renderPage();
    await waitFor(() => expect(screen.getByTestId("change-password-form")).toBeDefined());

    fireEvent.change(screen.getByTestId("change-current"), { target: { value: "OldPass123!" } });
    fireEvent.change(screen.getByTestId("change-new"), { target: { value: "NewPass123!" } });
    fireEvent.change(screen.getByTestId("change-confirm"), { target: { value: "NewPass123!" } });
    fireEvent.click(screen.getByTestId("change-submit"));

    await waitFor(() => expect(screen.getByTestId("probe-path")).toBeDefined());
    expect(screen.getByTestId("probe-path").textContent).toBe("/my-tickets");
  });
});
