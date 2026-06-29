// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const navigateMock = vi.fn();
const setSearchParamsMock = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useSearchParams: () => [new URLSearchParams("doc=terms"), setSearchParamsMock],
  };
});

const themeMock = vi.hoisted(() => ({ darkMode: false }));
vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => themeMock,
}));

vi.mock("../../components/LegalDocumentContent", () => ({
  default: ({ documentType, darkMode }) => (
    <div data-testid="legal-content">
      {documentType} - {darkMode ? "dark" : "light"}
    </div>
  ),
}));

import LegalPage from "../../pages/LegalPage";

describe("LegalPage dedicated", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    setSearchParamsMock.mockReset();
  });

  it("renders Legal Center heading and description", () => {
    render(<MemoryRouter><LegalPage /></MemoryRouter>);
    expect(screen.getByText("Legal Center")).toBeInTheDocument();
    expect(screen.getByText(/Review the Terms of Service/)).toBeInTheDocument();
  });

  it("renders Terms and Privacy document tabs", () => {
    render(<MemoryRouter><LegalPage /></MemoryRouter>);
    expect(screen.getByText("Terms of Service")).toBeInTheDocument();
    expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
  });

  it("renders document content for the active tab", () => {
    render(<MemoryRouter><LegalPage /></MemoryRouter>);
    expect(screen.getByTestId("legal-content")).toHaveTextContent("terms - light");
  });

  it("switches to privacy tab when clicked", () => {
    render(<MemoryRouter><LegalPage /></MemoryRouter>);
    fireEvent.click(screen.getByText("Privacy Policy"));
    expect(setSearchParamsMock).toHaveBeenCalled();
    const callArgs = setSearchParamsMock.mock.calls[0];
    const params = callArgs[0];
    expect(params.get("doc")).toBe("privacy");
  });

  it("renders Back button and navigates when clicked", () => {
    render(<MemoryRouter><LegalPage /></MemoryRouter>);
    fireEvent.click(screen.getByText("Back"));
    expect(navigateMock).toHaveBeenCalled();
  });

  it("renders settings link at the bottom", () => {
    render(<MemoryRouter><LegalPage /></MemoryRouter>);
    expect(screen.getByText("Open Settings")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Open Settings"));
    expect(navigateMock).toHaveBeenCalledWith("/settings");
  });

  it("renders help text about data requests", () => {
    render(<MemoryRouter><LegalPage /></MemoryRouter>);
    expect(screen.getByText(/Need help with data requests/)).toBeInTheDocument();
  });

  it("navigates back with navigate(-1) when window history length > 1", () => {
    const originalHistoryLength = window.history.length;
    Object.defineProperty(window.history, "length", {
      value: 5,
      configurable: true,
    });

    render(<MemoryRouter><LegalPage /></MemoryRouter>);
    fireEvent.click(screen.getByText("Back"));
    expect(navigateMock).toHaveBeenCalledWith(-1);

    Object.defineProperty(window.history, "length", {
      value: originalHistoryLength,
      configurable: true,
    });
  });

  it("renders dark mode layout when darkMode is true", () => {
    themeMock.darkMode = true;
    render(<MemoryRouter><LegalPage /></MemoryRouter>);
    expect(screen.getByText("Back")).toHaveClass("border-gray-700");
    themeMock.darkMode = false; // Reset
  });
});
