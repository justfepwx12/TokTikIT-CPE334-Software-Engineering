/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Header from "../../src/components/Header";
import * as api from "../../src/api";
import { AuthProvider } from "../../src/context/AuthContext";

vi.mock("lucide-react", () => {
  const stub = () => null;
  return {
    Clock: stub, FileText: stub, PlusCircle: stub, Inbox: stub, Users: stub,
    UserCircle: stub, Menu: stub, X: stub, ChevronDown: stub, LogOut: stub,
  };
});

function userFor(role: api.UserRole): api.AuthUser {
  return { id: 7, name: "Sam Shell", email: "sam@toktikit.com", role, isActive: true, mustChangePassword: false };
}

function renderHeader(role: api.UserRole) {
  vi.spyOn(api, "getSessionUser").mockResolvedValue({ user: userFor(role) });
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/my-tickets"]}>
        <Header />
      </MemoryRouter>
    </AuthProvider>
  );
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("Lab 3 AppShell role-aware navigation (BR-05 visual)", () => {
  it("shows My Tickets + Create Ticket for requesters", async () => {
    renderHeader("REQUESTER");
    await waitFor(() => expect(screen.getAllByText("Sam Shell").length).toBeGreaterThanOrEqual(1));
    expect(screen.getAllByText("My Tickets").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Create Ticket").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Ticket Queue")).toBeNull();
    expect(screen.queryByText("Users")).toBeNull();
  });

  it("shows the queue but no creation or users for IT staff", async () => {
    renderHeader("IT_STAFF");
    await waitFor(() => expect(screen.getAllByText("Sam Shell").length).toBeGreaterThanOrEqual(1));
    expect(screen.getAllByText("Ticket Queue").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("My Tickets").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Create Ticket")).toBeNull();
    expect(screen.queryByText("Users")).toBeNull();
  });

  it("shows queue navigation plus Users for administrators with name and logout", async () => {
    renderHeader("ADMIN");
    await waitFor(() => expect(screen.getAllByText("Sam Shell").length).toBeGreaterThanOrEqual(1));
    expect(screen.getAllByText("Ticket Queue").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("My Tickets").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Users").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Create Ticket")).toBeNull();
    expect(screen.getAllByText("Log out").length).toBeGreaterThanOrEqual(1);
  });
});
