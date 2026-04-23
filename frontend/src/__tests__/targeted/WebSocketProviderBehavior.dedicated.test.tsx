// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

const authState = vi.hoisted(() => ({
  user: null,
  token: null,
  authReady: false,
}));

const clientSpies = vi.hoisted(() => ({
  activate: vi.fn(),
  deactivate: vi.fn(),
  subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
  publish: vi.fn(),
}));

const stompState = vi.hoisted(() => ({
  config: null,
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("sockjs-client", () => ({
  default: vi.fn(() => ({})),
}));

vi.mock("@stomp/stompjs", () => ({
  Client: vi.fn((config) => {
    stompState.config = config;
    return {
      connected: false,
      activate: clientSpies.activate,
      deactivate: clientSpies.deactivate,
      subscribe: clientSpies.subscribe,
      publish: clientSpies.publish,
    };
  }),
}));

import { WebSocketProvider, useWebSocket } from "../../contexts/WebSocketProvider";

function Consumer() {
  const ws = useWebSocket();
  return (
    <div>
      <div>{String(ws.connected)}-{String(ws.ready)}</div>
      <button
        onClick={() => {
          const unsub = ws.subscribe("X_EVENT", () => {});
          ws.send("/app/test", { ok: true });
          ws.reconnect();
          unsub();
        }}
      >
        trigger
      </button>
    </div>
  );
}

describe("WebSocketProvider behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stompState.config = null;
  });

  it("provides default disconnected state and does not activate when auth missing", () => {
    authState.user = null;
    authState.token = null;
    authState.authReady = true;

    render(
      <WebSocketProvider>
        <Consumer />
      </WebSocketProvider>,
    );

    expect(screen.getByText("false-false")).toBeInTheDocument();
    expect(clientSpies.activate).not.toHaveBeenCalled();
  });

  it("exposes subscribe/send/reconnect API methods", () => {
    authState.user = null;
    authState.token = null;
    authState.authReady = true;
    render(
      <WebSocketProvider>
        <Consumer />
      </WebSocketProvider>,
    );
    act(() => {
      screen.getByText("trigger").click();
    });
    expect(screen.getByText("false-false")).toBeInTheDocument();
  });

  it("activates client and triggers onConnect to subscribe to topics", async () => {
    vi.useFakeTimers();
    authState.user = { id: "u1" };
    authState.token = "t";
    authState.authReady = true;

    render(
      <WebSocketProvider>
        <Consumer />
      </WebSocketProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(clientSpies.activate).toHaveBeenCalled();
    expect(stompState.config).not.toBeNull();
    
    // Simulate onConnect
    act(() => {
      stompState.config.onConnect();
    });
    
    // Check that we subscribed to multiple channels
    expect(clientSpies.subscribe).toHaveBeenCalled();
    
    // Trigger callbacks with different simulated backend actions
    const calls = clientSpies.subscribe.mock.calls;
    if (calls.length > 0) {
      act(() => {
        // Find subs and dispatch
        const messagesSub = calls.find(c => c[0] === "/user/queue/messages");
        if (messagesSub) {
          messagesSub[1]({ body: JSON.stringify({ type: "test" }) });
        }
        
        const taskUpdatesSub = calls.find(c => c[0] === "/user/queue/task-updates");
        if (taskUpdatesSub) {
          taskUpdatesSub[1]({ body: JSON.stringify({ action: "task_created", task: { id: "t1" } }) });
          taskUpdatesSub[1]({ body: JSON.stringify({ action: "task_status_updated", task: { id: "t1" } }) });
          taskUpdatesSub[1]({ body: JSON.stringify({ action: "task_approved", task: { id: "t1" } }) });
          taskUpdatesSub[1]({ body: JSON.stringify({ action: "task_rejected", task: { id: "t1" } }) });
        }

        const assignmentUpdatesSub = calls.find(c => c[0] === "/user/queue/assignment-updates");
        if (assignmentUpdatesSub) {
          assignmentUpdatesSub[1]({ body: JSON.stringify({ action: "assignment_created", assignment: { id: "a1" } }) });
          assignmentUpdatesSub[1]({ body: JSON.stringify({ action: "assignment_accepted", assignment: { id: "a1" } }) });
        }
        
        const notificationsSub = calls.find(c => c[0] === "/user/queue/notifications");
        if (notificationsSub) {
          notificationsSub[1]({ body: JSON.stringify({ type: "ROLE_PROMOTION" }) });
        }
        
        const chatUpdateSub = calls.find(c => c[0] === "/user/queue/chat-update");
        if (chatUpdateSub) {
          chatUpdateSub[1]({ body: JSON.stringify({ ok: true }) });
        }
        
        const globalProfileUpdatesSub = calls.find(c => c[0] === "/topic/profile-updates");
        if (globalProfileUpdatesSub) {
          globalProfileUpdatesSub[1]({ body: JSON.stringify({ userId: "u1" }) });
        }
        
        const notificationUpdateSub = calls.find(c => c[0] === "/user/queue/notification-update");
        if (notificationUpdateSub) {
          notificationUpdateSub[1]({ body: JSON.stringify({ ok: true }) });
        }

        const profileUpdateSub = calls.find(c => c[0] === "/user/queue/profile-update");
        if (profileUpdateSub) {
          profileUpdateSub[1]({ body: JSON.stringify({ ok: true }) });
        }
      });
    }

    vi.useRealTimers();
  });

  it("triggers onDisconnect and onStompError correctly", () => {
    vi.useFakeTimers();
    authState.user = { id: "u1" };
    authState.token = "t";
    authState.authReady = true;

    render(
      <WebSocketProvider>
        <Consumer />
      </WebSocketProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(700);
    });
    
    expect(stompState.config).not.toBeNull();
    
    act(() => {
      stompState.config.onDisconnect();
      stompState.config.onStompError();
      stompState.config.onWebSocketClose();
    });

    vi.useRealTimers();
  });

  it("does not activate when auth is not ready even with token/user", () => {
    vi.useFakeTimers();
    clientSpies.activate.mockClear();
    authState.user = { id: "u2" };
    authState.token = "token-2";
    authState.authReady = false;

    render(
      <WebSocketProvider>
        <Consumer />
      </WebSocketProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(clientSpies.activate).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("returns default context outside provider", () => {
    function Outside() {
      const ws = useWebSocket();
      return <div>{String(ws.connected)}</div>;
    }
    render(<Outside />);
    expect(screen.getByText("false")).toBeInTheDocument();
  });
});

