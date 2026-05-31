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
  register: vi.fn(),
}));

vi.mock("../../utils/api", () => ({
  authAPI: { register: mocks.register },
}));

import SignUpPage from "../../pages/SignupPage";

describe("SignUpPage dedicated", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    mocks.register.mockReset();
  });

  it("renders signup form with all fields", () => {
    render(<MemoryRouter><SignUpPage /></MemoryRouter>);
    expect(screen.getByText("Create Account")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email Address")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password (min. 8 chars)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Confirm Password")).toBeInTheDocument();
  });

  it("shows error when passwords do not match", async () => {
    render(<MemoryRouter><SignUpPage /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "user1" } });
    fireEvent.change(screen.getByPlaceholderText("Email Address"), { target: { value: "u@x.com" } });
    fireEvent.change(screen.getByPlaceholderText("Password (min. 8 chars)"), { target: { value: "password1" } });
    fireEvent.change(screen.getByPlaceholderText("Confirm Password"), { target: { value: "different" } });
    fireEvent.click(screen.getByText("Sign Up"));

    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("shows error when password is too short", async () => {
    render(<MemoryRouter><SignUpPage /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "user1" } });
    fireEvent.change(screen.getByPlaceholderText("Email Address"), { target: { value: "u@x.com" } });
    fireEvent.change(screen.getByPlaceholderText("Password (min. 8 chars)"), { target: { value: "short" } });
    fireEvent.change(screen.getByPlaceholderText("Confirm Password"), { target: { value: "short" } });
    fireEvent.click(screen.getByText("Sign Up"));

    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
  });

  it("successful registration navigates to login", async () => {
    mocks.register.mockResolvedValue({ ok: true });
    render(<MemoryRouter><SignUpPage /></MemoryRouter>);

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "newuser" } });
    fireEvent.change(screen.getByPlaceholderText("Email Address"), { target: { value: "new@x.com" } });
    fireEvent.change(screen.getByPlaceholderText("Password (min. 8 chars)"), { target: { value: "password123" } });
    fireEvent.change(screen.getByPlaceholderText("Confirm Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByText("Sign Up"));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/login", expect.anything()));
  });

  it("shows API error on registration failure", async () => {
    mocks.register.mockRejectedValue(new Error("Email already exists"));
    render(<MemoryRouter><SignUpPage /></MemoryRouter>);

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "newuser" } });
    fireEvent.change(screen.getByPlaceholderText("Email Address"), { target: { value: "dup@x.com" } });
    fireEvent.change(screen.getByPlaceholderText("Password (min. 8 chars)"), { target: { value: "password123" } });
    fireEvent.change(screen.getByPlaceholderText("Confirm Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByText("Sign Up"));

    await waitFor(() => expect(screen.getByText("Email already exists")).toBeInTheDocument());
  });

  it("toggles password visibility", () => {
    render(<MemoryRouter><SignUpPage /></MemoryRouter>);
    const pwInput = screen.getByPlaceholderText("Password (min. 8 chars)");
    expect(pwInput.type).toBe("password");

    // Find the eye toggle button near the password field
    const toggleButtons = document.querySelectorAll('button[type="button"]');
    const pwToggle = Array.from(toggleButtons).find(b =>
      b.closest(".relative")?.querySelector('input[placeholder="Password (min. 8 chars)"]')
    );
    if (pwToggle) {
      fireEvent.click(pwToggle);
      expect(pwInput.type).toBe("text");
    }
  });

  it("sends company code and admin key when provided", async () => {
    mocks.register.mockResolvedValue({ ok: true });
    render(<MemoryRouter><SignUpPage /></MemoryRouter>);

    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "admin1" } });
    fireEvent.change(screen.getByPlaceholderText("Email Address"), { target: { value: "admin@x.com" } });
    fireEvent.change(screen.getByPlaceholderText("Password (min. 8 chars)"), { target: { value: "password123" } });
    fireEvent.change(screen.getByPlaceholderText("Confirm Password"), { target: { value: "password123" } });
    fireEvent.change(screen.getByPlaceholderText("ABC12345"), { target: { value: "COMP01" } });
    fireEvent.change(screen.getByPlaceholderText("Enter key for elevated permissions"), { target: { value: "adminkey" } });
    fireEvent.click(screen.getByText("Sign Up"));

    await waitFor(() => {
      expect(mocks.register).toHaveBeenCalledWith(expect.objectContaining({
        companyCode: "COMP01",
        adminKey: "adminkey",
      }));
    });
  });

  it("navigates to login page via Sign in link", () => {
    render(<MemoryRouter><SignUpPage /></MemoryRouter>);
    fireEvent.click(screen.getByText("Sign in"));
    expect(navigateMock).toHaveBeenCalledWith("/login");
  });
});
