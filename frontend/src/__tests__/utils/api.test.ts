// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  incrementProfileImageVersion,
  getProfileImageUrl,
  tasksAPI,
  employeesAPI,
  usersAPI,
  aiAPI,
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

  it("adds Authorization and X-Company-Id headers when present", async () => {
    localStorage.setItem("token", "t");
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
    expect(opts.headers.Authorization).toBe("Bearer t");
    expect(opts.headers["X-Company-Id"]).toBe("c1");
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
});

