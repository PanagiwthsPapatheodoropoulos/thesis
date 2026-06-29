// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const logoutMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ logout: logoutMock }),
}));
vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: false }),
}));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => navigateMock };
});

import PromotionModal from "../../components/PromotionModal";

describe("PromotionModal dedicated", () => {
  beforeEach(() => {
    logoutMock.mockReset();
    navigateMock.mockReset();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(<PromotionModal isOpen={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders congratulations content when open", () => {
    render(<PromotionModal isOpen={true} />);
    expect(screen.getByText("🎉 Congratulations!")).toBeInTheDocument();
    expect(screen.getByText("Your account has been promoted.")).toBeInTheDocument();
    expect(screen.getByText("New Role: Employee")).toBeInTheDocument();
    expect(screen.getByText("Session Refresh Required")).toBeInTheDocument();
  });

  it("renders custom title, message, and roleName", () => {
    render(
      <PromotionModal
        isOpen={true}
        title="Upgraded!"
        message="You are now a Manager"
        roleName="MANAGER"
      />
    );
    expect(screen.getByText("Upgraded!")).toBeInTheDocument();
    expect(screen.getByText("You are now a Manager")).toBeInTheDocument();
    expect(screen.getByText("New Role: MANAGER")).toBeInTheDocument();
  });

  it("logs out and navigates to login on button click", () => {
    render(<PromotionModal isOpen={true} />);
    fireEvent.click(screen.getByText("Proceed to Login"));
    expect(logoutMock).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("/login");
  });

  it("shows session refresh info", () => {
    render(<PromotionModal isOpen={true} />);
    expect(screen.getByText(/Your access permissions have changed/)).toBeInTheDocument();
  });
});
