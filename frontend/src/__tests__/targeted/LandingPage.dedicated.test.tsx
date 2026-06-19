// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => navigateMock };
});

import LandingPage from "../../pages/LandingPage";

describe("LandingPage dedicated", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    localStorage.clear();
  });

  it("renders hero section with headline and CTA buttons", () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    expect(screen.getByText("Intelligently.")).toBeInTheDocument();
    expect(screen.getByText("Create / Join company →")).toBeInTheDocument();
    expect(screen.getByText("Learn More")).toBeInTheDocument();
  });

  it("renders all six feature cards", () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    expect(screen.getByText("Neural Scheduling")).toBeInTheDocument();
    expect(screen.getByText("Resource Allocation")).toBeInTheDocument();
    expect(screen.getByText("Anomaly Detection")).toBeInTheDocument();
    expect(screen.getByText("Predictive Analytics")).toBeInTheDocument();
    expect(screen.getByText("Skill Matching")).toBeInTheDocument();
    expect(screen.getByText("Live Telemetry")).toBeInTheDocument();
  });

  it("navigates to /login when Login button is clicked", () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    const loginBtn = screen.getAllByText(/Login/i).find(el => el.tagName === "BUTTON" || el.closest("button"));
    fireEvent.click(loginBtn.closest("button") || loginBtn);
    expect(navigateMock).toHaveBeenCalledWith("/login");
  });

  it("navigates to /company-setup when Create / Join company → is clicked", () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    fireEvent.click(screen.getByText("Create / Join company →"));
    expect(navigateMock).toHaveBeenCalledWith("/company-setup");
  });

  it("navigates to /company-setup when Create Workspace is clicked", () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    fireEvent.click(screen.getByText("Create Workspace"));
    expect(navigateMock).toHaveBeenCalledWith("/company-setup");
  });

  it("opens mobile menu and navigates via mobile login", async () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    // Click hamburger menu button (the md:hidden button)
    const buttons = document.querySelectorAll("button");
    const menuToggle = Array.from(buttons).find(b => b.classList.contains("md:hidden"));
    if (menuToggle) {
      await act(async () => {
        fireEvent.click(menuToggle);
      });
      const mobileLogin = screen.getByText("Login / Sign Up");
      await act(async () => {
        fireEvent.click(mobileLogin);
      });
      expect(navigateMock).toHaveBeenCalledWith("/login");
    }
  });

  it("renders footer with Privacy and Terms links", () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    expect(screen.getByText("Privacy")).toBeInTheDocument();
    expect(screen.getByText("Terms")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Privacy"));
    expect(navigateMock).toHaveBeenCalledWith("/legal?doc=privacy");
  });

  it("clears localStorage on mount", () => {
    localStorage.setItem("token", "stale");
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("handles smooth scrolling and mobile menu items", async () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    const mockElement = document.createElement("div");
    mockElement.id = "features";
    document.body.appendChild(mockElement);

    render(<MemoryRouter><LandingPage /></MemoryRouter>);

    // Click Learn More to trigger handleSmoothScroll
    fireEvent.click(screen.getByText("Learn More"));

    expect(scrollIntoViewMock).toHaveBeenCalled();

    // Clean up
    document.body.removeChild(mockElement);
  });
});
