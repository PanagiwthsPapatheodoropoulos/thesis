import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CompanySetupPage from "../../pages/CompanySetupPage";
import { authAPI, usersAPI } from "../../utils/api";
import { useAuth } from "../../contexts/AuthContext";

let currentUser: any = null;
const mockLogout = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock("../../utils/api", () => ({
  companiesAPI: { getJoinCode: vi.fn() },
  authAPI: {
    registerCompany: vi.fn(),
    register: vi.fn(),
  },
  usersAPI: {
    joinCompany: vi.fn(),
  },
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: currentUser,
    updateUser: mockUpdateUser,
    logout: mockLogout,
  }),
}));

const renderWithRouter = () => {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<CompanySetupPage />} />
      </Routes>
    </MemoryRouter>
  );
};

describe("CompanySetupPage coverage", () => {
  beforeEach(() => {
    currentUser = null;
    mockLogout.mockClear();
    mockUpdateUser.mockClear();
    vi.clearAllMocks();
  });

  it("renders initial mode selection", () => {
    renderWithRouter();
    expect(screen.getByText("Company Setup")).toBeInTheDocument();
    expect(screen.getByText("Create Company")).toBeInTheDocument();
    expect(screen.getByText("Join Company")).toBeInTheDocument();
  });

  it("navigates back to initial selection from create mode", () => {
    renderWithRouter();
    fireEvent.click(screen.getByText("Create Company"));
    expect(screen.getByText("Create Organization")).toBeInTheDocument();
    
    fireEvent.click(screen.getByText("Back"));
    expect(screen.getByText("Company Setup")).toBeInTheDocument();
  });

  it("handles creating a company successfully", async () => {
    (authAPI.registerCompany as any).mockResolvedValueOnce({ joinCode: "CODE123" });
    renderWithRouter();
    
    fireEvent.click(screen.getByText("Create Company"));
    
    // Fill out form
    fireEvent.change(screen.getByPlaceholderText("Company Name"), { target: { value: "Tech Corp" } });
    fireEvent.change(screen.getByPlaceholderText("Admin Username"), { target: { value: "admin" } });
    fireEvent.change(screen.getByPlaceholderText("Admin Email"), { target: { value: "admin@test.com" } });
    
    const passwordInputs = screen.getAllByPlaceholderText(/Password/i);
    fireEvent.change(passwordInputs[0], { target: { value: "pass123" } });
    fireEvent.change(screen.getByPlaceholderText("Confirm Password"), { target: { value: "pass123" } });
    
    fireEvent.click(screen.getByText("Create Company", { selector: "button" }));
    
    await waitFor(() => {
      expect(authAPI.registerCompany).toHaveBeenCalledWith({
        companyName: "Tech Corp",
        adminUsername: "admin",
        adminEmail: "admin@test.com",
        adminPassword: "pass123"
      });
    });
  });

  it("shows error if passwords do not match during creation", async () => {
    renderWithRouter();
    fireEvent.click(screen.getByText("Create Company"));
    
    fireEvent.change(screen.getByPlaceholderText("Company Name"), { target: { value: "Tech Corp" } });
    fireEvent.change(screen.getByPlaceholderText("Admin Username"), { target: { value: "admin" } });
    fireEvent.change(screen.getByPlaceholderText("Admin Email"), { target: { value: "admin@test.com" } });
    
    const passwordInputs = screen.getAllByPlaceholderText(/Password/i);
    fireEvent.change(passwordInputs[0], { target: { value: "pass123" } });
    fireEvent.change(screen.getByPlaceholderText("Confirm Password"), { target: { value: "different" } });
    
    fireEvent.click(screen.getByText("Create Company", { selector: "button" }));
    
    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(authAPI.registerCompany).not.toHaveBeenCalled();
  });

  it("handles join company successfully", async () => {
    (authAPI.register as any).mockResolvedValueOnce({});
    renderWithRouter();
    
    fireEvent.click(screen.getByText("Join Company"));
    
    fireEvent.change(screen.getByPlaceholderText("CODE"), { target: { value: "CODE123" } });
    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "user" } });
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "user@test.com" } });
    
    const passwordInputs = screen.getAllByPlaceholderText(/Password/i);
    fireEvent.change(passwordInputs[0], { target: { value: "pass123" } });
    fireEvent.change(screen.getByPlaceholderText("Confirm Password"), { target: { value: "pass123" } });
    
    fireEvent.click(screen.getByText("Join Company", { selector: "button" }));
    
    await waitFor(() => {
      expect(authAPI.register).toHaveBeenCalledWith({
        username: "user",
        email: "user@test.com",
        password: "pass123",
        companyCode: "CODE123"
      });
    });
  });

  it("shows error if passwords do not match during join", async () => {
    renderWithRouter();
    fireEvent.click(screen.getByText("Join Company"));
    
    fireEvent.change(screen.getByPlaceholderText("CODE"), { target: { value: "CODE" } });
    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "u" } });
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "u@v.com" } });
    
    const passwordInputs = screen.getAllByPlaceholderText(/Password/i);
    fireEvent.change(passwordInputs[0], { target: { value: "pass123" } });
    fireEvent.change(screen.getByPlaceholderText("Confirm Password"), { target: { value: "different" } });
    
    fireEvent.click(screen.getByText("Join Company", { selector: "button" }));
    
    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
  });

  it("displays server error during join", async () => {
    (authAPI.register as any).mockRejectedValueOnce(new Error("Invalid Code"));
    renderWithRouter();
    
    fireEvent.click(screen.getByText("Join Company"));
    
    fireEvent.change(screen.getByPlaceholderText("CODE"), { target: { value: "CODE" } });
    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "u" } });
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "u@v.com" } });
    fireEvent.change(screen.getAllByPlaceholderText(/Password/i)[0], { target: { value: "pw" } });
    fireEvent.change(screen.getByPlaceholderText("Confirm Password"), { target: { value: "pw" } });
    
    fireEvent.click(screen.getByText("Join Company", { selector: "button" }));
    
    expect(await screen.findByText("Invalid Code")).toBeInTheDocument();
  });

  it("renders rejoin flow when user is logged in without company", async () => {
    currentUser = { id: "user-1", username: "JohnUser", role: "EMPLOYEE" };
    renderWithRouter();

    expect(screen.getByText("Company Access Required")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("CODE")).toBeInTheDocument();
  });

  it("handles rejoin company successfully", async () => {
    currentUser = { id: "user-1", username: "JohnUser", role: "EMPLOYEE" };
    (usersAPI.joinCompany as any).mockResolvedValueOnce({
      companyId: "c-9",
      companyName: "New Company",
      role: "EMPLOYEE",
    });

    renderWithRouter();

    fireEvent.change(screen.getByPlaceholderText("CODE"), { target: { value: "REJOIN" } });
    fireEvent.click(screen.getByText("Join Company"));

    await waitFor(() => {
      expect(usersAPI.joinCompany).toHaveBeenCalledWith("user-1", "REJOIN");
      expect(mockUpdateUser).toHaveBeenCalledWith({
        companyId: "c-9",
        companyName: "New Company",
        role: "EMPLOYEE",
      });
    });
  });

  it("displays error during rejoin failure", async () => {
    currentUser = { id: "user-1", username: "JohnUser", role: "EMPLOYEE" };
    (usersAPI.joinCompany as any).mockRejectedValueOnce(new Error("Failed rejoin"));

    renderWithRouter();

    fireEvent.change(screen.getByPlaceholderText("CODE"), { target: { value: "FAIL" } });
    fireEvent.click(screen.getByText("Join Company"));

    expect(await screen.findByText("Failed rejoin")).toBeInTheDocument();
  });

  it("handles logout from rejoin screen", async () => {
    currentUser = { id: "user-1", username: "JohnUser", role: "EMPLOYEE" };
    renderWithRouter();

    fireEvent.click(screen.getByText("Sign Out"));
    expect(mockLogout).toHaveBeenCalled();
  });
});
