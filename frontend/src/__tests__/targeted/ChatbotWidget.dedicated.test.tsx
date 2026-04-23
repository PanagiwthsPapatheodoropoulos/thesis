// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ChatbotWidget from "../../components/ChatbotWidget";
import { chatbotAPI } from "../../utils/api";
import { useAuth } from "../../contexts/AuthContext";

vi.mock("../../utils/api", () => ({
  chatbotAPI: {
    health: vi.fn(),
    query: vi.fn(),
  },
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

describe("ChatbotWidget coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: { id: "u1", username: "AdminUser", role: "ADMIN" }
    });

    // Mock HTML element methods used by layout
    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    // Mock SpeechSynthesis
    window.speechSynthesis = {
      cancel: vi.fn(),
      speak: vi.fn((utterance) => {
        if (utterance.onstart) utterance.onstart();
        if (utterance.onend) setTimeout(utterance.onend, 10);
      }),
    };
    global.SpeechSynthesisUtterance = vi.fn();

    // Mock global fetch for audio transcription
    global.fetch = vi.fn();

    // Mock MediaDevices
    global.MediaRecorder = class {
      constructor() {
        this.state = "inactive";
      }
      start() {
        this.state = "recording";
        if (this.onstart) this.onstart();
      }
      stop() {
        this.state = "inactive";
        if (this.onstop) this.onstop();
      }
    };

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }]
        }),
      },
      writable: true
    });
    
    window.alert = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not render when no user", async () => {
    chatbotAPI.health.mockResolvedValue({ status: "healthy" });
    useAuth.mockReturnValue({ user: null });
    
    let container;
    await act(async () => {
      const res = render(<MemoryRouter><ChatbotWidget /></MemoryRouter>);
      container = res.container;
    });
    
    expect(container).toBeEmptyDOMElement();
  });

  it("opens closed chat and verifies health check logic", async () => {
    chatbotAPI.health.mockResolvedValue({ status: "healthy" });
    
    render(<MemoryRouter><ChatbotWidget /></MemoryRouter>);
    
    // Initially closed, shows floating button
    const openBtn = screen.getByTitle(/Open AI Assistant|AI Assistant - Connecting/);
    expect(openBtn).toBeInTheDocument();
    
    await act(async () => {
      fireEvent.click(openBtn);
    });
    
    // Chat window should be open
    await waitFor(() => {
      expect(screen.getByText("AI Assistant")).toBeInTheDocument();
    });
    
    // Check greeting
    expect(screen.getByText(/You have \*\*full admin access\*\*/)).toBeInTheDocument();
  });

  it("handles failed health checks and manual retry", async () => {
    // Fail first check
    chatbotAPI.health.mockRejectedValueOnce(new Error("Down"));
    
    render(<MemoryRouter><ChatbotWidget /></MemoryRouter>);
    
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    
    await waitFor(() => {
      // Retry button should appear when 'checking' or error
      const retryBtn = screen.getByTitle("Retry connection");
      expect(retryBtn).toBeInTheDocument();
    });
    
    // Manual retry success
    chatbotAPI.health.mockResolvedValueOnce({ status: "healthy" });
    await act(async () => {
      fireEvent.click(screen.getByTitle("Retry connection"));
    });
    
    await waitFor(() => {
      expect(screen.getByText("Powered by Phi-3")).toBeInTheDocument();
    });
  });

  it("sends a message and receives response", async () => {
    chatbotAPI.health.mockResolvedValue({ status: "healthy" });
    chatbotAPI.query.mockResolvedValue({ response: "I am an AI." });
    
    render(<MemoryRouter><ChatbotWidget /></MemoryRouter>);
    await act(async () => fireEvent.click(screen.getByRole("button")));
    
    const input = await screen.findByPlaceholderText("Ask me anything...");
    
    await act(async () => {
      fireEvent.change(input, { target: { value: "Hello" } });
      fireEvent.click(screen.getByTitle("Send message"));
    });
    
    expect(chatbotAPI.query).toHaveBeenCalledWith({
      query: "Hello",
      context: expect.any(Object)
    });
    
    await waitFor(() => {
      expect(screen.getByText("I am an AI.")).toBeInTheDocument();
    });
  });

  it("handles query error", async () => {
    chatbotAPI.health.mockResolvedValue({ status: "healthy" });
    chatbotAPI.query.mockRejectedValue(new Error("Failed to fetch"));
    
    render(<MemoryRouter><ChatbotWidget /></MemoryRouter>);
    await act(async () => fireEvent.click(screen.getByRole("button")));
    
    const input = await screen.findByPlaceholderText("Ask me anything...");
    
    await act(async () => {
      fireEvent.change(input, { target: { value: "Bad Request" } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' }); // fallback
      fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });
    });
    
    await waitFor(() => {
      expect(screen.getByText((content, element) => 
        content.includes("I'm having trouble connecting right now.")
      )).toBeInTheDocument();
    });
  });

  it("handles voice recording", async () => {
    chatbotAPI.health.mockResolvedValue({ status: "healthy" });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ text: "Voice text" })
    });
    
    render(<MemoryRouter><ChatbotWidget /></MemoryRouter>);
    await act(async () => fireEvent.click(screen.getByRole("button")));
    
    const micBtn = await screen.findByTitle("Start voice input (click to start)");
    
    await act(async () => {
      fireEvent.click(micBtn);
    });
    
    // Expect media recorder to be mocked and started
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    
    // Click again to stop
    await act(async () => {
      fireEvent.click(screen.getByTitle("Stop listening (click to stop)"));
    });
    
    // Transcribed text should appear in input
    await waitFor(() => {
      expect(screen.getByDisplayValue("Voice text")).toBeInTheDocument();
    });
  });

  it("toggles sound/speech synthesis", async () => {
    chatbotAPI.health.mockResolvedValue({ status: "healthy" });
    chatbotAPI.query.mockResolvedValue({ response: "Audio response" });
    
    render(<MemoryRouter><ChatbotWidget /></MemoryRouter>);
    await act(async () => fireEvent.click(screen.getByRole("button")));
    
    // Toggle sound on
    await act(async () => {
      fireEvent.click(screen.getByTitle("Enable sound"));
    });
    
    // Send message to trigger bot response
    const input = await screen.findByPlaceholderText("Ask me anything...");
    await act(async () => {
      fireEvent.change(input, { target: { value: "Speak" } });
      fireEvent.click(screen.getByTitle("Send message"));
    });
    
    await waitFor(() => {
      expect(window.speechSynthesis.speak).toHaveBeenCalled();
    });
    
    // Toggle sound off
    await act(async () => {
      fireEvent.click(screen.getByTitle("Disable sound"));
    });
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });

  it("minimizes and restores chat", async () => {
    chatbotAPI.health.mockResolvedValue({ status: "healthy" });
    render(<MemoryRouter><ChatbotWidget /></MemoryRouter>);
    await act(async () => fireEvent.click(screen.getByRole("button")));
    
    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
    
    // Minimize
    await act(async () => {
      fireEvent.click(screen.getByTitle("Minimize"));
    });
    // The input should be gone when minimized
    expect(screen.queryByPlaceholderText("Ask me anything...")).not.toBeInTheDocument();
    
    // Maximize
    await act(async () => {
      fireEvent.click(screen.getByTitle("Minimize"));
    });
    expect(screen.getByPlaceholderText("Ask me anything...")).toBeInTheDocument();
    
    // Close
    await act(async () => {
      fireEvent.click(screen.getByTitle("Close"));
    });
    expect(screen.queryByText("AI Assistant")).not.toBeInTheDocument();
  });
});
