// @ts-nocheck
import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { AuthProvider } from "../contexts/AuthContext";
import { ThemeProvider } from "../contexts/ThemeContext";

export function setStoredAuth({ user = null, token = null, companyId = null } = {}) {
  localStorage.clear();
  sessionStorage.clear();

  if (user) localStorage.setItem("user", JSON.stringify(user));
  if (token) localStorage.setItem("token", token);
  if (companyId) localStorage.setItem("companyId", companyId);
}

export function setStoredTheme({ darkMode = true } = {}) {
  localStorage.setItem("darkMode", JSON.stringify(darkMode));
}

export function renderWithProviders(ui, { route = "/" } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <ThemeProvider>{ui}</ThemeProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

export function mockFetchJson(data, { ok = true, status = 200, headers = { "content-type": "application/json" } } = {}) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? "OK" : "Bad Request",
    headers: {
      get: (k) => headers[k.toLowerCase()] ?? headers[k] ?? null,
    },
    json: async () => data,
    text: async () => (typeof data === "string" ? data : JSON.stringify(data)),
  });
}

