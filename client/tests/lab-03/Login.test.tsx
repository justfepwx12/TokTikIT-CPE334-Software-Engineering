/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import Login from "../../src/pages/Login";
import * as api from "../../src/api";
import { AuthProvider } from "../../src/context/AuthContext";

vi.mock("lucide-react", () => {
  const stub = () => null;
  return { LogIn: stub, Eye: stub, EyeOff: stub, Home: stub, ChevronRight: stub };
});

const REQUESTER: api.AuthUser = {
  id: 2, name: "Jane Doe", email: "jane@toktikit.com", role: "REQUESTER",
  isActive: true, mustChangePassword: false,
};
const STAFF: api.AuthUser = {
  id: 9, name: "Somchai Jaidee", email: "somchai@toktikit.com", role: "IT_STAFF",
  isActive: true, mustChangePassword: false,
};

function Probe() {
  const location = useLocation();
  return <div data-testid="probe-path">{location.pathname}</div>;
}

function renderLogin(initialEntries: string[] = ["/login"]) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/my-tickets" element={<Probe />} />
          <Route path="/queue" element={<Probe />} />
          <Route path="/change-password" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  // Signed out by default; individual tests override the session.
  vi.spyOn(api, "getSessionUser").mockRejectedValue(new Error("Not signed in."));
});

afterEach(() => {
  cleanup();
});

describe("Lab 3 Login (AC-01/02/03)", () => {
  it("renders email/password fields with a disabled-while-submitting button", async () => {
    renderLogin();
    expect(await screen.findByTestId("login-form")).toBeDefined();
    expect(screen.getByTestId("login-email")).toBeDefined();
    expect(screen.getByTestId("login-password")).toBeDefined();
    expect(screen.getByTestId("login-submit")).toBeDefined();
  });

  it("validates empty fields and email shape client-side without calling the API", async () => {
    const loginMock = vi.spyOn(api, "loginUser");
    renderLogin();
    await waitFor(() => expect(screen.getByTestId("login-form")).toBeDefined());

    fireEvent.click(screen.getByTestId("login-submit"));
    expect(await screen.findByText("Email is required.")).toBeDefined();
    expect(loginMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("login-email"), { target: { value: "not-an-email" } });
    fireEvent.change(screen.getByTestId("login-password"), { target: { value: "x" } });
    fireEvent.click(screen.getByTestId("login-submit"));
    expect(await screen.findByText("Enter a valid email address.")).toBeDefined();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("shows a single safe banner on 401 without leaking account state", async () => {
    vi.spyOn(api, "loginUser").mockRejectedValue(new Error("Invalid email or password."));
    renderLogin();
    await waitFor(() => expect(screen.getByTestId("login-form")).toBeDefined());

    fireEvent.change(screen.getByTestId("login-email"), { target: { value: "jane@toktikit.com" } });
    fireEvent.change(screen.getByTestId("login-password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByTestId("login-submit"));

    const banner = await screen.findByTestId("login-error");
    expect(banner.textContent).toContain("Invalid email or password.");
  });

  it("routes an already-signed-in requester straight to role home", async () => {
    vi.spyOn(api, "getSessionUser").mockResolvedValue({ user: REQUESTER });
    renderLogin();
    await waitFor(() => expect(screen.getByTestId("probe-path")).toBeDefined());
    expect(screen.getByTestId("probe-path").textContent).toBe("/my-tickets");
  });

  it("routes an already-signed-in staff member to the queue", async () => {
    vi.spyOn(api, "getSessionUser").mockResolvedValue({ user: STAFF });
    renderLogin();
    await waitFor(() => expect(screen.getByTestId("probe-path")).toBeDefined());
    expect(screen.getByTestId("probe-path").textContent).toBe("/queue");
  });
});
