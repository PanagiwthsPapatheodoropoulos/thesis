// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  incrementProfileImageVersion,
  getProfileImageUrl,
  tasksAPI,
  employeesAPI,
  usersAPI,
  aiAPI,
  authAPI,
} from "../../utils/api";

describe("utils/api", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("increments profile image version and appends v param", () => {
    const base = "http://x/profile";
    const url1 = getProfileImageUrl(base);
    const v1 = url1.split("v=")[1];
    expect(v1).toBeTruthy();

    const v2 = incrementProfileImageVersion();
    const url2 = getProfileImageUrl(base);
    expect(url2).toContain(`v=${v2}`);
  });

  it("adds X-Company-Id header when present (HttpOnly cookie used for auth)", async () => {
    localStorage.setItem("companyId", "c1");

    fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => [],
      text: async () => "",
      status: 200,
      statusText: "OK",
    });

    await tasksAPI.getAll();

    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBeUndefined();
    expect(opts.headers["X-Company-Id"]).toBe("c1");
    expect(opts.credentials).toBe("same-origin"); // Interceptor adds credentials
  });

  it("handleResponse throws with server text on error (via employeesAPI.getAll)", async () => {
    fetch.mockResolvedValue({
      ok: false,
      headers: { get: () => "text/plain" },
      json: async () => ({}),
      text: async () => "Nope",
      status: 400,
      statusText: "Bad Request",
    });

    await expect(employeesAPI.getAll()).rejects.toThrow("Nope");
  });

  it("removeFromCompany appends reason query param", async () => {
    fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({}),
      text: async () => "",
      status: 200,
      statusText: "OK",
    });

    await usersAPI.removeFromCompany("u1", "BLOCKED");

    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain("/users/u1/remove-from-company?reason=BLOCKED");
    expect(opts.method).toBe("PATCH");
  });

  it("joinCompany posts company code payload", async () => {
    fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ id: "u1" }),
      text: async () => "",
      status: 200,
      statusText: "OK",
    });

    await usersAPI.joinCompany("u1", "CODE123");

    const [, opts] = fetch.mock.calls[0];
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ companyCode: "CODE123" });
  });

  it("prioritizeBacklog posts task list", async () => {
    fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ prioritized: [] }),
      text: async () => "",
      status: 200,
      statusText: "OK",
    });

    const tasks = [{ title: "Task 1" }];
    await aiAPI.prioritizeBacklog(tasks);

    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain("/ai/task-analysis/prioritize-backlog");
    expect(JSON.parse(opts.body)).toEqual(tasks);
  });

  describe("authAPI and usersAPI remaining endpoints", () => {
    it("authAPI login, register, logout, and registerCompany post payloads", async () => {
      fetch.mockResolvedValue({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ ok: true }),
        text: async () => "",
        status: 200,
      });

      await authAPI.login({ email: "a@b.com", password: "1" });
      await authAPI.register({ username: "a", email: "a@b.com" });
      await authAPI.logout();
      await authAPI.registerCompany({ companyName: "C" });

      expect(fetch).toHaveBeenCalledTimes(4);
    });

    it("usersAPI getAll, getById, update, updateStatus, updateUsername, and delete work", async () => {
      fetch.mockResolvedValue({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ id: "u1" }),
        text: async () => "ok",
        status: 200,
      });

      await usersAPI.getAll();
      await usersAPI.getById("u1");
      await usersAPI.update("u1", { username: "new" });
      await usersAPI.updateStatus("u1", "AWAY");
      await usersAPI.updateUsername("u1", "newname");
      await usersAPI.delete("u1");

      expect(fetch).toHaveBeenCalledTimes(6);
    });

    it("usersAPI delete throws on error", async () => {
      fetch.mockResolvedValue({
        ok: false,
        headers: { get: () => "application/json" },
        status: 500,
      });
      await expect(usersAPI.delete("u1")).rejects.toThrow("Failed to delete user");
    });

    it("usersAPI removeFromCompany throws on error", async () => {
      fetch.mockResolvedValue({
        ok: false,
        headers: { get: () => "application/json" },
        status: 500,
      });
      await expect(usersAPI.removeFromCompany("u1")).rejects.toThrow("Failed to remove user from company");
    });
  });

  describe("handleResponse error parsing and validation formatting", () => {
    it("formats validationErrors in handleResponse", async () => {
      fetch.mockResolvedValue({
        ok: false,
        headers: { get: () => "application/json" },
        text: async () => JSON.stringify({
          message: "Validation failed",
          validationErrors: { email: "Invalid email", username: "Too short" }
        }),
        status: 400,
        statusText: "Bad Request",
      });

      await expect(employeesAPI.getAll()).rejects.toThrow("Validation failed: email: Invalid email, username: Too short");
    });

    it("uses error property if message is missing", async () => {
      fetch.mockResolvedValue({
        ok: false,
        headers: { get: () => "application/json" },
        text: async () => JSON.stringify({
          error: "Forbidden Resource"
        }),
        status: 403,
      });

      await expect(employeesAPI.getAll()).rejects.toThrow("Forbidden Resource");
    });
  });
});

