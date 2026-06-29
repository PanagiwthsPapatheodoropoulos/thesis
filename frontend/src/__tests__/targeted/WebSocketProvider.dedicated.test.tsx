// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const state = vi.hoisted(() => ({
  auth: { user: { id: "u1" }, token: "t1", authReady: true, updateUser: vi.fn() },
  activate: vi.fn(),
  deactivate: vi.fn(),
  subscribeImpl: vi.fn(() => ({ unsubscribe: vi.fn() })),
  publish: vi.fn(),
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => state.auth,
}));

vi.mock("sockjs-client", () => ({
  default: vi.fn(() => ({})),
}));

vi.mock("@stomp/stompjs", () => {
  class MockClient {
    constructor(config) {
      this.config = config;
      this.connected = false;
      this.subscribe = state.subscribeImpl;
      this.publish = state.publish;
      this.activate = () => {
        state.activate();
        this.connected = true;
        this.config.onConnect?.();
      };
      this.deactivate = () => {
        state.deactivate();
        this.connected = false;
      };
    }
  }
  return { Client: MockClient };
});

import { WebSocketProvider, useWebSocket } from "../../contexts/WebSocketProvider";

function Probe() {
  const { reconnect, send } = useWebSocket();
  React.useEffect(() => {
    send("/topic/x", { hi: 1 });
    reconnect();
  }, [reconnect, send]);
  return <div>probe</div>;
}

describe("WebSocketProvider dedicated", () => {
  beforeEach(() => {
    state.auth = { user: { id: "u1" }, token: "t1", authReady: true, updateUser: vi.fn() };
    state.activate.mockClear();
    state.deactivate.mockClear();
    state.subscribeImpl.mockClear();
    state.publish.mockClear();
  });

  it("does not connect when auth is not ready", async () => {
    state.auth = { user: null, token: null, authReady: false };
    render(
      <WebSocketProvider>
        <div>noop</div>
      </WebSocketProvider>,
    );
    await new Promise((r) => setTimeout(r, 700));
    expect(state.activate).not.toHaveBeenCalled();
  });

  it("connects and supports reconnect flow", async () => {
    render(
      <WebSocketProvider>
        <Probe />
      </WebSocketProvider>,
    );
    await waitFor(() => expect(state.activate).toHaveBeenCalled());
    expect(state.activate.mock.calls.length).toBeGreaterThan(0);
  });

  it("subscribes to topics and broadcasts events when messages arrive", async () => {
    const subscriptions = {};
    state.subscribeImpl.mockImplementation((topic, callback) => {
      subscriptions[topic] = callback;
      return { unsubscribe: vi.fn() };
    });

    const received = [];
    function ConsumerComponent() {
      const { subscribe } = useWebSocket();
      React.useEffect(() => {
        return subscribe("NEW_MESSAGE", (data) => {
          received.push(data);
        });
      }, [subscribe]);
      return <div>consumer</div>;
    }

    render(
      <WebSocketProvider>
        <ConsumerComponent />
      </WebSocketProvider>,
    );

    await waitFor(() => expect(state.activate).toHaveBeenCalled());

    // Trigger messages STOMP callback
    const chatCallback = subscriptions["/user/queue/messages"];
    expect(chatCallback).toBeDefined();

    chatCallback({ body: JSON.stringify({ id: "m1", message: "hello" }) });
    expect(received).toEqual([{ id: "m1", message: "hello" }]);
  });
});

