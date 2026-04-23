// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const authState = vi.hoisted(() => ({
  user: { id: "u1", username: "alice", role: "ADMIN" },
}));

const mocks = vi.hoisted(() => ({
  health: vi.fn(),
  query: vi.fn(),
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("react-router-dom", async (orig) => {
  const mod = await orig();
  return { ...mod, useLocation: () => ({ pathname: "/dashboard" }) };
});

vi.mock("../../utils/api", () => ({
  chatbotAPI: {
    health: mocks.health,
    query: mocks.query,
  },
}));

import ChatbotWidget from "../../components/ChatbotWidget";

describe("ChatbotWidget interactions", () => {
  beforeEach(() => {
    mocks.health.mockResolvedValue({ status: "healthy" });
    mocks.query.mockResolvedValue({ response: "AI reply" });
  });

  it("does not render when user is missing", () => {
    authState.user = null;
    const { container } = render(
      <MemoryRouter>
        <ChatbotWidget />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("opens assistant and sends a message", async () => {
    authState.user = { id: "u1", username: "alice", role: "ADMIN" };
    render(
      <MemoryRouter>
        <ChatbotWidget />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.health).toHaveBeenCalled());
    fireEvent.click(screen.getByTitle(/Open AI Assistant/i));
    await waitFor(() => expect(screen.getByText(/AI Assistant/i)).toBeInTheDocument());

    const input = screen.getByPlaceholderText(/Ask me anything/i);
    fireEvent.change(input, { target: { value: "hello bot" } });
    const buttons = document.querySelectorAll("button");
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(mocks.query).toHaveBeenCalled());
  });
});

