// @ts-nocheck
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// We need real Toast, not the mocked one from setupTests
vi.unmock("../../components/Toast");

// We need ThemeContext for Toast to work
vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: false }),
}));

import { ToastProvider, useToast } from "../../components/Toast";

function TestConsumer() {
  const { showToast } = useToast();
  return (
    <div>
      <button onClick={() => showToast("Success msg", "success")}>ShowSuccess</button>
      <button onClick={() => showToast("Error msg", "error")}>ShowError</button>
      <button onClick={() => showToast("Warning msg", "warning")}>ShowWarning</button>
      <button onClick={() => showToast("Info msg", "info")}>ShowInfo</button>
    </div>
  );
}

describe("Toast system dedicated", () => {
  it("useToast throws outside provider", () => {
    function BadComponent() {
      useToast();
      return null;
    }
    expect(() => render(<BadComponent />)).toThrow("useToast must be used within a ToastProvider");
  });

  it("shows success toast with message", () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    act(() => fireEvent.click(screen.getByText("ShowSuccess")));
    expect(screen.getByText("Success msg")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("shows error toast", () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    act(() => fireEvent.click(screen.getByText("ShowError")));
    expect(screen.getByText("Error msg")).toBeInTheDocument();
  });

  it("shows warning toast", () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    act(() => fireEvent.click(screen.getByText("ShowWarning")));
    expect(screen.getByText("Warning msg")).toBeInTheDocument();
  });

  it("shows info toast", () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    act(() => fireEvent.click(screen.getByText("ShowInfo")));
    expect(screen.getByText("Info msg")).toBeInTheDocument();
  });

  it("dismiss button removes toast", async () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    act(() => fireEvent.click(screen.getByText("ShowSuccess")));
    expect(screen.getByText("Success msg")).toBeInTheDocument();

    const dismissBtn = screen.getByLabelText("Dismiss");
    act(() => fireEvent.click(dismissBtn));

    // After dismiss animation (200ms)
    await vi.waitFor(() => {
      expect(screen.queryByText("Success msg")).not.toBeInTheDocument();
    }, { timeout: 500 });
  });

  it("limits max visible toasts to 5", () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    // Show 6 toasts quickly
    for (let i = 0; i < 6; i++) {
      act(() => fireEvent.click(screen.getByText("ShowSuccess")));
    }

    // Should have at most 5 alerts visible
    const alerts = screen.getAllByRole("alert");
    expect(alerts.length).toBeLessThanOrEqual(5);
  });
});
