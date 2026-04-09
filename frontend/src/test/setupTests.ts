import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Browser APIs used by charting/layout libs
if (!("ResizeObserver" in globalThis)) {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserver;
}

if (!("IntersectionObserver" in globalThis)) {
  class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
    root = null;
    rootMargin = "";
    thresholds = [];
  }
  globalThis.IntersectionObserver = IntersectionObserver;
}

if (!window.matchMedia) {
  window.matchMedia = () =>
    ({
      matches: false,
      media: "",
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

window.scrollTo = window.scrollTo || (() => {});
window.alert = window.alert || (() => {});
globalThis.alert = globalThis.alert || (() => {});
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Default fetch mock to avoid real network calls from page useEffects
if (!globalThis.fetch) {
  globalThis.fetch = vi.fn();
}

vi.stubGlobal(
  "fetch",
  vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    let payload: unknown = {};

    if (url.includes("/tasks/paginated")) {
      payload = { content: [], totalPages: 1, totalElements: 0, number: 0, size: 20 };
    } else if (url.includes("/employees/paginated")) {
      payload = { content: [], totalPages: 1, totalElements: 0, number: 0, size: 20 };
    } else if (url.includes("/teams/paginated")) {
      payload = { content: [], totalPages: 1, totalElements: 0, number: 0, size: 20 };
    } else if (url.includes("/dashboard") || url.includes("/analytics")) {
      payload = {};
    } else if (url.includes("/notifications")) {
      payload = [];
    } else if (url.includes("/chat")) {
      payload = [];
    } else if (url.includes("/employees")) {
      payload = [];
    } else if (url.includes("/tasks")) {
      payload = [];
    } else if (url.includes("/departments")) {
      payload = [];
    } else if (url.includes("/teams")) {
      payload = [];
    } else if (url.includes("/users")) {
      payload = [];
    } else if (url.includes("/auth/login")) {
      payload = { token: "t", user: { id: "u1", role: "ADMIN" } };
    } else if (url.includes("/auth/register")) {
      payload = { ok: true };
    }

    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => "application/json" },
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    };
  }),
);

