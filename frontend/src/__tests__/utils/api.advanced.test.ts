// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  tasksAPI,
  employeesAPI,
  departmentsAPI,
  companiesAPI,
  blocklistAPI,
  chatbotAPI,
  aiAPI,
} from "../../utils/api";

describe("utils/api advanced mechanisms", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("window", {
      location: {
        href: "",
      },
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe("JWT Auto-Refresh", () => {
    it("refreshes token and throws TOKEN_REFRESHED when API call gets 401 without retry context", async () => {
      localStorage.setItem("token", "old-token");
      localStorage.setItem("refreshToken", "valid-refresh-token");

      fetch
        .mockResolvedValueOnce({
          status: 401,
          ok: false,
          headers: { get: () => "application/json" },
          text: async () => JSON.stringify({ message: "Unauthorized" }),
        })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          headers: { get: () => "application/json" },
          json: async () => ({ token: "new-token", refreshToken: "new-refresh-token" }),
        });

      await expect(tasksAPI.getAll()).rejects.toThrow("TOKEN_REFRESHED");

      expect(localStorage.getItem("token")).toBe("new-token");
      expect(localStorage.getItem("refreshToken")).toBe("new-refresh-token");
      expect(fetch).toHaveBeenCalledTimes(2);

      const [refreshUrl, refreshOpts] = fetch.mock.calls[1];
      expect(refreshUrl).toContain("/auth/refresh");
      expect(JSON.parse(refreshOpts.body)).toEqual({ refreshToken: "valid-refresh-token" });
    });

    it("clears storage and redirects to /login if token refresh fails", async () => {
      localStorage.setItem("token", "old-token");
      localStorage.setItem("refreshToken", "invalid-refresh-token");

      fetch
        .mockResolvedValueOnce({
          status: 401,
          ok: false,
          headers: { get: () => "application/json" },
          text: async () => JSON.stringify({ message: "Unauthorized" }),
        })
        .mockResolvedValueOnce({
          status: 400,
          ok: false,
          headers: { get: () => "application/json" },
          text: async () => JSON.stringify({ message: "Invalid refresh token" }),
        });

      await expect(tasksAPI.getAll()).rejects.toThrow("Session expired. Please log in again.");

      expect(localStorage.getItem("token")).toBeNull();
      expect(window.location.href).toBe("/login");
    });
  });

  describe("robust response parsing", () => {
    it("handles variations in employeesAPI.getSkills response", async () => {
      // 1. Success with array
      fetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ["React", "TypeScript"],
      });
      const skills1 = await employeesAPI.getSkills("emp-1");
      expect(skills1).toEqual(["React", "TypeScript"]);

      // 2. Success with object containing skills array
      fetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ skills: ["React", "TypeScript"] }),
      });
      const skills2 = await employeesAPI.getSkills("emp-1");
      expect(skills2).toEqual(["React", "TypeScript"]);

      // 3. Fallback when response structure is unexpected
      fetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ raw: "garbage" }),
      });
      const skills3 = await employeesAPI.getSkills("emp-1");
      expect(skills3).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith(
        "Unexpected skills response format:",
        { raw: "garbage" }
      );
    });

    it("returns empty results array when anomaly detection API fails", async () => {
      fetch.mockRejectedValueOnce(new Error("AI Service down"));

      const result = await aiAPI.detectAnomalies({ entityType: "task", entityId: "task-1" });
      expect(result).toEqual({ results: [] });
    });
  });

  describe("miscellaneous API wrappers coverage", () => {
    it("departmentsAPI.toggleDevInfo triggers PUT request", async () => {
      fetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ success: true }),
      });

      await departmentsAPI.toggleDevInfo("Engineering", true);

      const [url, opts] = fetch.mock.calls[0];
      expect(url).toContain("/departments/Engineering/toggle-dev-info?enabled=true");
      expect(opts.method).toBe("PUT");
    });

    it("companiesAPI.regenerateJoinCode triggers POST request", async () => {
      fetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ joinCode: "NEW123" }),
      });

      await companiesAPI.regenerateJoinCode("comp-1");

      const [url, opts] = fetch.mock.calls[0];
      expect(url).toContain("/companies/comp-1/regenerate-code");
      expect(opts.method).toBe("POST");
    });

    it("blocklistAPI handles CRUD operations correctly", async () => {
      fetch.mockResolvedValue({
        status: 200,
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({}),
      });

      await blocklistAPI.getAll();
      expect(fetch.mock.calls[0][0]).toContain("/blocklist");

      await blocklistAPI.block("test@test.com");
      expect(fetch.mock.calls[1][0]).toContain("/blocklist");
      expect(fetch.mock.calls[1][1].method).toBe("POST");
      expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ email: "test@test.com" });

      await blocklistAPI.unblock("entry-1");
      expect(fetch.mock.calls[2][0]).toContain("/blocklist/entry-1");
      expect(fetch.mock.calls[2][1].method).toBe("DELETE");
    });

    it("chatbotAPI handles query, health, and pullModel correctly", async () => {
      fetch.mockResolvedValue({
        status: 200,
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({}),
      });

      await chatbotAPI.query({ query: "Hello", context: {} });
      expect(fetch.mock.calls[0][0]).toContain("/ai/chatbot/query");
      expect(fetch.mock.calls[0][1].method).toBe("POST");

      await chatbotAPI.health();
      expect(fetch.mock.calls[1][0]).toContain("/ai/chatbot/health");

      await chatbotAPI.pullModel("phi3");
      expect(fetch.mock.calls[2][0]).toContain("/ai/chatbot/pull-model?model_name=phi3");
      expect(fetch.mock.calls[2][1].method).toBe("POST");
    });
  });
});
