// @ts-nocheck
import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AuthProvider, useAuth } from "../../contexts/AuthContext";

function Consumer() {
  const { user, token, loading, authReady, login, logout, updateUser } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="ready">{String(authReady)}</div>
      <div data-testid="user">{user ? user.username : "none"}</div>
      <div data-testid="token">{token || "none"}</div>
      <button onClick={() => login({ username: "u1", role: "EMPLOYEE" }, "t1")}>login</button>
      <button onClick={() => updateUser({ username: "u2" })}>update</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

describe("AuthContext", () => {
  it("restores credentials from localStorage on mount", async () => {
    localStorage.setItem("user", JSON.stringify({ username: "restored", role: "EMPLOYEE" }));
    localStorage.setItem("token", "tok");

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("ready").textContent).toBe("true");
    });

    expect(screen.getByTestId("user").textContent).toBe("restored");
    expect(screen.getByTestId("token").textContent).toBe("tok");
  });

  it("login persists user/token and logout clears them", async () => {
    const u = userEvent.setup();
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await u.click(screen.getByText("login"));

    expect(JSON.parse(localStorage.getItem("user")).username).toBe("u1");
    expect(localStorage.getItem("token")).toBe("t1");
    expect(sessionStorage.getItem("activeSession")).toBe("true");

    await u.click(screen.getByText("update"));
    expect(JSON.parse(localStorage.getItem("user")).username).toBe("u2");

    await u.click(screen.getByText("logout"));
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });
});

