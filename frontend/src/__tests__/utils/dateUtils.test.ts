import { describe, it, expect } from "vitest";
import { parseUTCDate, formatDate, getRelativeTime } from "../../utils/dateUtils";

describe("dateUtils", () => {
  describe("parseUTCDate", () => {
    it("returns current date when input is null, undefined or empty", () => {
      const now = new Date().getTime();
      expect(parseUTCDate(null).getTime()).toBeGreaterThanOrEqual(now - 100);
      expect(parseUTCDate(undefined).getTime()).toBeGreaterThanOrEqual(now - 100);
      expect(parseUTCDate("").getTime()).toBeGreaterThanOrEqual(now - 100);
      expect(parseUTCDate("   ").getTime()).toBeGreaterThanOrEqual(now - 100);
    });

    it("returns the same Date instance if input is a Date object", () => {
      const date = new Date(2023, 10, 5);
      const result = parseUTCDate(date);
      expect(result).toBe(date);
    });

    it("parses ISO date string without timezone as UTC", () => {
      // "2026-05-25T12:00:00" without timezone should be appended with "Z" and parsed as UTC
      const result = parseUTCDate("2026-05-25T12:00:00");
      expect(result.toISOString()).toBe("2026-05-25T12:00:00.000Z");
    });

    it("parses date string with space separator as UTC", () => {
      const result = parseUTCDate("2026-05-25 12:00:00");
      expect(result.toISOString()).toBe("2026-05-25T12:00:00.000Z");
    });

    it("respects timezone offset if already present in ISO string", () => {
      const result = parseUTCDate("2026-05-25T12:00:00Z");
      expect(result.toISOString()).toBe("2026-05-25T12:00:00.000Z");

      const offsetResult = parseUTCDate("2026-05-25T14:00:00+02:00");
      expect(offsetResult.toISOString()).toBe("2026-05-25T12:00:00.000Z");
    });

    it("falls back to standard parser for other formats", () => {
      const result = parseUTCDate("2026-05-25");
      // Standard Date parsing for date-only string defaults to UTC in ISO-compliant runtimes
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(4); // May is 0-indexed
      expect(result.getUTCDate()).toBe(25);
    });
  });

  describe("formatDate", () => {
    it("returns N/A if dateInput is missing", () => {
      expect(formatDate(null)).toBe("N/A");
      expect(formatDate(undefined)).toBe("N/A");
    });

    it("formats dates correctly using local string", () => {
      const date = new Date("2026-05-25T12:00:00.000Z");
      expect(formatDate(date)).toBe(date.toLocaleString());
    });
  });

  describe("getRelativeTime", () => {
    it("returns empty string if input is missing", () => {
      expect(getRelativeTime(null)).toBe("");
      expect(getRelativeTime(undefined)).toBe("");
    });

    it("returns 'just now' for very recent timestamps", () => {
      const now = new Date();
      expect(getRelativeTime(now)).toBe("just now");

      const thirtySecAgo = new Date(now.getTime() - 30 * 1000);
      expect(getRelativeTime(thirtySecAgo)).toBe("just now");
    });

    it("returns minutes ago representation", () => {
      const now = new Date();
      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
      expect(getRelativeTime(fiveMinAgo)).toBe("5m ago");
    });

    it("returns hours ago representation", () => {
      const now = new Date();
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      expect(getRelativeTime(threeHoursAgo)).toBe("3h ago");
    });

    it("returns days ago representation", () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      expect(getRelativeTime(twoDaysAgo)).toBe("2d ago");
    });

    it("returns absolute locale date string for dates older than 7 days", () => {
      const date = new Date("2020-05-25T12:00:00.000Z");
      expect(getRelativeTime(date)).toBe(date.toLocaleDateString());
    });
  });
});
