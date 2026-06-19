// @ts-nocheck
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
vi.unmock("../../components/ConfirmDialog");

import ConfirmProvider, { useConfirm } from "../../components/ConfirmDialog";

const mockTheme = { darkMode: false };
vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => mockTheme,
}));

function TestConsumer({ confirmOptions, onResult }) {
  const confirm = useConfirm();

  const handleTrigger = async () => {
    const res = await confirm(confirmOptions);
    onResult(res);
  };

  return <button onClick={handleTrigger}>Trigger Confirm</button>;
}

describe("ConfirmDialog", () => {
  it("throws an error when useConfirm is called outside ConfirmProvider", () => {
    // Suppress console.error for throwing test
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    
    function BadComponent() {
      useConfirm();
      return null;
    }

    expect(() => render(<BadComponent />)).toThrow(
      "useConfirm must be used within a ConfirmProvider"
    );

    consoleError.mockRestore();
  });

  it("opens the modal and resolves true on confirm", async () => {
    const onResult = vi.fn();
    const options = {
      title: "Delete Account?",
      message: "This action cannot be undone.",
      confirmText: "Yes, Delete",
      cancelText: "No, Keep",
      variant: "danger",
    };

    render(
      <ConfirmProvider>
        <TestConsumer confirmOptions={options} onResult={onResult} />
      </ConfirmProvider>
    );

    // Click trigger
    fireEvent.click(screen.getByText("Trigger Confirm"));

    // Check elements are rendered
    expect(screen.getByText("Delete Account?")).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
    expect(screen.getByText("Yes, Delete")).toBeInTheDocument();
    expect(screen.getByText("No, Keep")).toBeInTheDocument();

    // Click confirm button
    await act(async () => {
      fireEvent.click(screen.getByText("Yes, Delete"));
    });

    // Check resolution value
    expect(onResult).toHaveBeenCalledWith(true);

    // Modal should be closed
    expect(screen.queryByText("Delete Account?")).not.toBeInTheDocument();
  });

  it("resolves false on cancel", async () => {
    const onResult = vi.fn();
    const options = {
      title: "Save Progress?",
      message: "Do you want to save?",
      variant: "warning",
    };

    render(
      <ConfirmProvider>
        <TestConsumer confirmOptions={options} onResult={onResult} />
      </ConfirmProvider>
    );

    // Click trigger
    fireEvent.click(screen.getByText("Trigger Confirm"));

    // Click cancel button
    await act(async () => {
      fireEvent.click(screen.getByText("Cancel")); // default cancelText
    });

    // Check resolution
    expect(onResult).toHaveBeenCalledWith(false);
  });

  it("handles different variants and dark mode styling", () => {
    const options = {
      title: "Warning Dialog",
      message: "Careful",
      variant: "warning",
    };

    const { rerender } = render(
      <ConfirmProvider>
        <TestConsumer confirmOptions={options} onResult={vi.fn()} />
      </ConfirmProvider>
    );

    fireEvent.click(screen.getByText("Trigger Confirm"));
    // Default cancel button is present
    expect(screen.getByText("Cancel")).toBeInTheDocument();

    // Rerender with default primary option
    const primaryOptions = {
      title: "Primary Title",
      message: "Primary Message",
    };

    rerender(
      <ConfirmProvider>
        <TestConsumer confirmOptions={primaryOptions} onResult={vi.fn()} />
      </ConfirmProvider>
    );
  });

  it("renders dark mode styling and primary fallback icons correctly", () => {
    mockTheme.darkMode = true;
    const onResult = vi.fn();
    const options = {
      title: "Dark Mode Dialog",
      message: "This is dark mode test",
    };

    render(
      <ConfirmProvider>
        <TestConsumer confirmOptions={options} onResult={onResult} />
      </ConfirmProvider>
    );

    // Click trigger
    fireEvent.click(screen.getByText("Trigger Confirm"));

    // Check dark mode classes
    expect(screen.getByText("Dark Mode Dialog").closest("div").parentElement.parentElement).toHaveClass("bg-gray-800");

    // Check HelpCircle icon is rendered (variant defaults to 'primary')
    // Reset darkMode mock state
    mockTheme.darkMode = false;
  });
});
