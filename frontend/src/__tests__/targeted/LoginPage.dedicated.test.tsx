// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => navigateMock };
});

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  authLogin: vi.fn(),
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ login: mocks.login, user: null, loading: false, authReady: true }),
}));

vi.mock("../../utils/api", () => ({
  companiesAPI: { getJoinCode: vi.fn() },
  authAPI: { login: mocks.authLogin },
}));

import LoginPage from "../../pages/LoginPage";

describe("LoginPage dedicated", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    mocks.login.mockReset();
    mocks.authLogin.mockReset();
  });

  it("renders login form with username and password fields", () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(screen.getByText("Welcome Back")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Username or Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.getByText("Sign In")).toBeInTheDocument();
  });

  it("successful login navigates to dashboard", async () => {
    mocks.authLogin.mockResolvedValue({ user: { id: "u1", role: "ADMIN", companyId: "c1" }, token: "tok", refreshToken: "rt" });
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    fireEvent.change(screen.getByPlaceholderText("Username or Email"), { target: { value: "admin" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "pass1234" } });
    fireEvent.click(screen.getByText("Sign In"));

    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith(
      { id: "u1", role: "ADMIN", companyId: "c1" }, "tok", "rt"
    ));
    expect(navigateMock).toHaveBeenCalledWith("/dashboard");
  });

  it("shows error on failed login", async () => {
    mocks.authLogin.mockRejectedValue(new Error("Bad credentials"));
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    fireEvent.change(screen.getByPlaceholderText("Username or Email"), { target: { value: "bad" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByText("Sign In"));

    await waitFor(() => expect(screen.getByText("Invalid credentials. Please try again.")).toBeInTheDocument());
  });

  it("shows loading state during submit", async () => {
    let resolveLogin;
    mocks.authLogin.mockImplementation(() => new Promise(r => { resolveLogin = r; }));
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    fireEvent.change(screen.getByPlaceholderText("Username or Email"), { target: { value: "user" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "pass1234" } });
    fireEvent.click(screen.getByText("Sign In"));

    expect(screen.getByText("Authenticating...")).toBeInTheDocument();
    resolveLogin({ user: { id: "u1" }, token: "t" });
    await waitFor(() => expect(screen.queryByText("Authenticating...")).not.toBeInTheDocument());
  });

  it("navigates to signup page", () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    fireEvent.click(screen.getByText("Sign up"));
    expect(navigateMock).toHaveBeenCalledWith("/signup");
  });

  it("navigates back to home", () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    const backBtn = document.querySelector("button");
    fireEvent.click(backBtn);
    expect(navigateMock).toHaveBeenCalledWith("/");
  });
});
