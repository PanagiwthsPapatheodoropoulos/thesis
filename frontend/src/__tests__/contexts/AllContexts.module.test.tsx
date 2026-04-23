// @ts-nocheck
import { describe, it, expect } from "vitest";

describe("all contexts modules", () => {
  it("loads AuthContext module", async () => {
    const mod = await import("../../contexts/AuthContext");
    expect(mod.AuthProvider).toBeTruthy();
    expect(mod.useAuth).toBeTruthy();
  });

  it("loads ThemeContext module", async () => {
    const mod = await import("../../contexts/ThemeContext");
    expect(mod.ThemeProvider).toBeTruthy();
    expect(mod.useTheme).toBeTruthy();
  });

  it("loads WebSocketProvider module", async () => {
    const mod = await import("../../contexts/WebSocketProvider");
    expect(mod.WebSocketProvider).toBeTruthy();
    expect(mod.useWebSocket).toBeTruthy();
    expect(mod.EVENT_TYPES).toBeTruthy();
  });
});

