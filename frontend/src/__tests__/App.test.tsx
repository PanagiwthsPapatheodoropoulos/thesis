// @ts-nocheck
import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import App from "../App";

describe("App", () => {
  it("renders app shell without crashing", () => {
    localStorage.setItem("user", JSON.stringify({ id: "u1", role: "ADMIN", username: "u", email: "u@x.com" }));
    localStorage.setItem("token", "t");
    localStorage.setItem("companyId", "c1");

    const r = render(<App />);
    expect(r.container).toBeTruthy();
  });
});

