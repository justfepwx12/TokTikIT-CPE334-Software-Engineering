/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import Login from "../../src/pages/Login";
import ForgotPassword from "../../src/pages/ForgotPassword";
import * as api from "../../src/api";
import { AuthProvider } from "../../src/context/AuthContext";

vi.mock("lucide-react", () => {
  const stub = () => null;
  return { LogIn: stub, Eye: stub, EyeOff: stub, Home: stub, ChevronRight: stub };
});

function Probe() {
  const location = useLocation();
  return <div data-testid="probe-path">{location.pathname}</div>;
}

function renderForgot(initialEntries: string[] = ["/forgot-password"]) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/login" element={<Probe />} />
          <Route path="/my-tickets" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

function renderLoginWithForgot() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<Probe />} />
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
  vi.spyOn(api, "getSessionUser").mockRejectedValue(new Error("Not signed in."));
});

afterEach(() => {
  cleanup();
});

describe("Forgot password (AD-09, BR-02)", () => {
  it("login shows a Forgot password link to /forgot-password", async () => {
    renderLoginWithForgot();
    await waitFor(() => expect(screen.getByTestId("login-form")).toBeDefined());

    const link = screen.getByTestId("forgot-password-link");
    expect(link.textContent).toContain("Forgot password?");
    expect(link.getAttribute("href")).toBe("/forgot-password");
  });

  it("renders the request form with a back-to-login link", async () => {
    renderForgot();
    expect(await screen.findByTestId("forgot-form")).toBeDefined();
    expect(screen.getByTestId("forgot-email")).toBeDefined();
    expect(screen.getByTestId("forgot-submit")).toBeDefined();
    expect(screen.getByTestId("forgot-back").getAttribute("href")).toBe("/login");
  });

  it("validates empty and malformed emails without confirming", async () => {
    renderForgot();
    await waitFor(() => expect(screen.getByTestId("forgot-form")).toBeDefined());

    fireEvent.click(screen.getByTestId("forgot-submit"));
    expect(await screen.findByText("Email is required.")).toBeDefined();
    expect(screen.queryByTestId("forgot-success")).toBeNull();

    fireEvent.change(screen.getByTestId("forgot-email"), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByTestId("forgot-submit"));
    expect(await screen.findByText("Enter a valid email address.")).toBeDefined();
    expect(screen.queryByTestId("forgot-success")).toBeNull();
  });

  it("shows the same neutral confirmation for any valid email (no enumeration)", async () => {
    renderForgot();
    await waitFor(() => expect(screen.getByTestId("forgot-form")).toBeDefined());

    fireEvent.change(screen.getByTestId("forgot-email"), { target: { value: "jane@toktikit.com" } });
    fireEvent.click(screen.getByTestId("forgot-submit"));

    const success = await screen.findByTestId("forgot-success");
    expect(success.textContent).toContain("contact");
    // The form is replaced — no second submit leaks anything.
    expect(screen.queryByTestId("forgot-form")).toBeNull();
  });
});
