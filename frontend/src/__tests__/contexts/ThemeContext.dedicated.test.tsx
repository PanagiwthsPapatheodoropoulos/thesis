// @ts-nocheck
import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

import { ThemeProvider, useTheme } from "../../contexts/ThemeContext";

function ThemeConsumer() {
  const { darkMode, toggleDarkMode } = useTheme();
  return (
    <div>
      <span data-testid="mode">{darkMode ? "dark" : "light"}</span>
      <button onClick={toggleDarkMode}>Toggle</button>
    </div>
  );
}

describe("ThemeContext dedicated coverage", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    document.body.classList.remove("bg-gray-900");
  });

  it("useTheme throws outside provider", () => {
    function BadComponent() {
      useTheme();
      return null;
    }
    expect(() => render(<BadComponent />)).toThrow("useTheme must be used within ThemeProvider");
  });

  it("defaults to dark mode when no preference saved", () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId("mode").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.body.classList.contains("bg-gray-900")).toBe(true);
  });

  it("restores light mode from localStorage", () => {
    localStorage.setItem("darkMode", "false");
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId("mode").textContent).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("restores dark mode from localStorage", () => {
    localStorage.setItem("darkMode", "true");
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId("mode").textContent).toBe("dark");
  });

  it("toggleDarkMode switches from dark to light", () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId("mode").textContent).toBe("dark");

    act(() => screen.getByText("Toggle").click());

    expect(screen.getByTestId("mode").textContent).toBe("light");
    expect(localStorage.getItem("darkMode")).toBe("false");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.body.classList.contains("bg-gray-900")).toBe(false);
  });

  it("toggleDarkMode switches from light to dark", () => {
    localStorage.setItem("darkMode", "false");
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId("mode").textContent).toBe("light");

    act(() => screen.getByText("Toggle").click());

    expect(screen.getByTestId("mode").textContent).toBe("dark");
    expect(localStorage.getItem("darkMode")).toBe("true");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.body.classList.contains("bg-gray-900")).toBe(true);
  });

  it("persists preference to localStorage on change", () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    // Default dark
    expect(localStorage.getItem("darkMode")).toBe("true");
    
    act(() => screen.getByText("Toggle").click());
    expect(localStorage.getItem("darkMode")).toBe("false");
    
    act(() => screen.getByText("Toggle").click());
    expect(localStorage.getItem("darkMode")).toBe("true");
  });
});
