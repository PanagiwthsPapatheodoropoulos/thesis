// @ts-nocheck
import { describe, it, expect, beforeEach } from "vitest";
import {
  getAuthHeaders,
  incrementProfileImageVersion,
  getProfileImageUrl,
} from "../../utils/api";

describe("API utility functions", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getAuthHeaders", () => {
    it("returns Content-Type without auth when no token", () => {
      const headers = getAuthHeaders();
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers.Authorization).toBeUndefined();
      expect(headers["X-Company-Id"]).toBeUndefined();
    });

    it("includes Authorization header when token exists", () => {
      localStorage.setItem("token", "my-jwt-token");
      const headers = getAuthHeaders();
      expect(headers.Authorization).toBe("Bearer my-jwt-token");
    });

    it("includes X-Company-Id when companyId exists", () => {
      localStorage.setItem("companyId", "company-123");
      const headers = getAuthHeaders();
      expect(headers["X-Company-Id"]).toBe("company-123");
    });

    it("includes both auth and company headers", () => {
      localStorage.setItem("token", "tok");
      localStorage.setItem("companyId", "c1");
      const headers = getAuthHeaders();
      expect(headers.Authorization).toBe("Bearer tok");
      expect(headers["X-Company-Id"]).toBe("c1");
    });
  });

  describe("incrementProfileImageVersion", () => {
    it("returns a new timestamp", () => {
      const before = Date.now();
      const version = incrementProfileImageVersion();
      expect(version).toBeGreaterThanOrEqual(before);
    });

    it("subsequent calls return increasing values", () => {
      const v1 = incrementProfileImageVersion();
      const v2 = incrementProfileImageVersion();
      expect(v2).toBeGreaterThanOrEqual(v1);
    });
  });

  describe("getProfileImageUrl", () => {
    it("returns null for null input", () => {
      expect(getProfileImageUrl(null)).toBeNull();
    });

    it("appends version query param to base URL", () => {
      incrementProfileImageVersion(); // set a version
      const url = getProfileImageUrl("http://localhost:8080/api/employees/123/profile-image");
      expect(url).toContain("http://localhost:8080/api/employees/123/profile-image?v=");
    });

    it("returns null for empty string by truthiness", () => {
      expect(getProfileImageUrl("")).toBeNull();
    });
  });
});
