// @ts-nocheck
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ThemeProvider, useTheme } from "../../contexts/ThemeContext";

function Consumer() {
  const { darkMode, toggleDarkMode } = useTheme();
  return (
    <div>
      <div data-testid="dark">{String(darkMode)}</div>
      <button onClick={toggleDarkMode}>toggle</button>
    </div>
  );
}

describe("ThemeContext", () => {
  it("defaults to dark mode when not set and toggles class", async () => {
    localStorage.removeItem("darkMode");
    const u = userEvent.setup();

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("dark").textContent).toBe("true");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await u.click(screen.getByText("toggle"));
    expect(screen.getByTestId("dark").textContent).toBe("false");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

