// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

import { AuthProvider, useAuth } from "../../contexts/AuthContext";

function AuthConsumer() {
  const { user, token, loading, authReady, login, logout, updateUser } = useAuth();
  return (
    <div>
      <span data-testid="user">{user ? JSON.stringify(user) : "none"}</span>
      <span data-testid="token">{token || "none"}</span>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="ready">{String(authReady)}</span>
      <button onClick={() => login({ id: "u1", role: "ADMIN", username: "test", email: "t@x.com" }, "jwt-token", "rt-token")}>Login</button>
      <button onClick={logout}>Logout</button>
      <button onClick={() => updateUser({ username: "updated" })}>Update</button>
    </div>
  );
}

describe("AuthContext dedicated coverage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.stompClient = undefined;
  });

  it("useAuth throws outside provider", () => {
    function BadComponent() {
      useAuth();
      return null;
    }
    expect(() => render(<BadComponent />)).toThrow("useAuth must be used within AuthProvider");
  });

  it("initializes with no user when localStorage empty", async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );
    // After initial mount, authReady should be true
    await vi.waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    expect(screen.getByTestId("user").textContent).toBe("none");
    expect(screen.getByTestId("token").textContent).toBe("none");
  });

  it("restores user from localStorage", async () => {
    localStorage.setItem("user", JSON.stringify({ id: "u1", role: "ADMIN", username: "test", email: "t@x.com" }));
    localStorage.setItem("token", "stored-token");

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await vi.waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    expect(screen.getByTestId("user").textContent).toContain("u1");
    expect(screen.getByTestId("token").textContent).toBe("cookie-based");
  });

  it("handles corrupt localStorage gracefully", async () => {
    localStorage.setItem("user", "not-valid-json{{{");
    localStorage.setItem("token", "tok");

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await vi.waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    // Should have cleared everything
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("login sets user, token, and persists to localStorage", async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await vi.waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));

    act(() => fireEvent.click(screen.getByText("Login")));

    expect(screen.getByTestId("user").textContent).toContain("u1");
    expect(screen.getByTestId("token").textContent).toBe("cookie-based");
            expect(sessionStorage.getItem("activeSession")).toBe("true");
  });

  it("logout clears state, localStorage, and sessionStorage", async () => {
    localStorage.setItem("user", JSON.stringify({ id: "u1", role: "ADMIN" }));
    localStorage.setItem("token", "tok");

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await vi.waitFor(() => expect(screen.getByTestId("user").textContent).toContain("u1"));

    act(() => fireEvent.click(screen.getByText("Logout")));

    await vi.waitFor(() => expect(screen.getByTestId("user").textContent).toBe("none"));
    expect(screen.getByTestId("token").textContent).toBe("none");
        expect(localStorage.getItem("user")).toBeNull();
  });

  it("logout handles stompClient deactivation", async () => {
    const deactivateMock = vi.fn();
    window.stompClient = { deactivate: deactivateMock };
    localStorage.setItem("user", JSON.stringify({ id: "u1", role: "ADMIN" }));
    localStorage.setItem("token", "tok");

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await vi.waitFor(() => expect(screen.getByTestId("user").textContent).toContain("u1"));

    act(() => fireEvent.click(screen.getByText("Logout")));

    await vi.waitFor(() => expect(deactivateMock).toHaveBeenCalled());
  });

  it("logout handles stompClient error gracefully", async () => {
    window.stompClient = { deactivate: () => { throw new Error("ws error"); } };
    localStorage.setItem("user", JSON.stringify({ id: "u1", role: "ADMIN" }));
    localStorage.setItem("token", "tok");

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await vi.waitFor(() => expect(screen.getByTestId("user").textContent).toContain("u1"));

    // Should not throw
    act(() => fireEvent.click(screen.getByText("Logout")));
    await vi.waitFor(() => expect(screen.getByTestId("user").textContent).toBe("none"));
  });

  it("updateUser merges partial data and persists", async () => {
    localStorage.setItem("user", JSON.stringify({ id: "u1", role: "ADMIN", username: "old", email: "e@x.com" }));
    localStorage.setItem("token", "tok");

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await vi.waitFor(() => expect(screen.getByTestId("user").textContent).toContain("old"));

    act(() => fireEvent.click(screen.getByText("Update")));

    expect(screen.getByTestId("user").textContent).toContain("updated");
    const stored = JSON.parse(localStorage.getItem("user"));
    expect(stored.username).toBe("updated");
    expect(stored.id).toBe("u1"); // preserved
  });
});
