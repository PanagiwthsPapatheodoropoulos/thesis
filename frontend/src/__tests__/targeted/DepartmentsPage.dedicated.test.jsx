import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import DepartmentsPage from "../../pages/DepartmentsPage.jsx";
import { departmentsAPI } from "../../utils/api";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";

vi.mock("../../utils/api", () => ({
  departmentsAPI: {
    getAll: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: vi.fn(),
}));

describe("DepartmentsPage coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn().mockReturnValue(true);

    useTheme.mockReturnValue({ darkMode: false });
    useAuth.mockReturnValue({ user: { role: "ADMIN" } });
  });

  const mockDepartments = [
    {
      name: "Engineering",
      description: "Builds things",
      employeeCount: 2,
      employees: [
        {
          id: "e1",
          firstName: "John",
          lastName: "Doe",
          position: "Dev",
          profileImageUrl: "http://example.com/img.jpg",
          skills: [{ id: "1", skillName: "React" }]
        },
        {
          id: "e2",
          firstName: "Jane",
          lastName: "Smith",
          position: "",
          skills: [
            { id: "s1", skillName: "Java" },
            { id: "s2", skillName: "Spring" },
            { id: "s3", skillName: "SQL" },
            { id: "s4", skillName: "AWS" }
          ]
        }
      ]
    },
    {
      name: "Empty Dept",
      employeeCount: 0,
      employees: []
    }
  ];

  it("renders loader initially and then departments", async () => {
    departmentsAPI.getAll.mockResolvedValueOnce(mockDepartments);
    render(<DepartmentsPage />);
    
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText("Engineering")).toBeInTheDocument();
      expect(screen.getByText("Builds things")).toBeInTheDocument();
      expect(screen.getByText("Empty Dept")).toBeInTheDocument();
    });
    
    // Stats
    expect(screen.getByText("Total Departments")).toBeInTheDocument();
    expect(screen.getByText("Total Employees")).toBeInTheDocument();
  });

  it("refetches on profileUpdated event", async () => {
    departmentsAPI.getAll.mockResolvedValue(mockDepartments);
    render(<DepartmentsPage />);
    
    await waitFor(() => expect(departmentsAPI.getAll).toHaveBeenCalledTimes(1));
    
    act(() => {
      window.dispatchEvent(new Event("profileUpdated"));
    });
    
    await waitFor(() => expect(departmentsAPI.getAll).toHaveBeenCalledTimes(2));
  });

  it("handles department creation", async () => {
    departmentsAPI.getAll.mockResolvedValueOnce([]);
    departmentsAPI.create.mockResolvedValueOnce({});
    departmentsAPI.getAll.mockResolvedValueOnce([{ name: "New Dept", employeeCount: 0 }]); // second call on refresh
    
    render(<DepartmentsPage />);
    await waitFor(() => expect(screen.queryByRole('heading', { level: 2 }))?.not.toBeInTheDocument());
    
    // Open modal
    fireEvent.click(screen.getByText(/New Department/i));
    expect(screen.getByText("Create New Department")).toBeInTheDocument();
    
    fireEvent.change(screen.getByPlaceholderText("e.g., Engineering, Marketing"), { target: { value: "New Dept" } });
    fireEvent.change(screen.getByPlaceholderText("Brief description of the department"), { target: { value: "Desc" } });
    
    fireEvent.click(screen.getByText("Create Department", { selector: 'button' }));
    
    await waitFor(() => {
      expect(departmentsAPI.create).toHaveBeenCalledWith({ name: "New Dept", description: "Desc" });
      expect(departmentsAPI.getAll).toHaveBeenCalledTimes(2);
    });
  });

  it("shows alert on creation failure", async () => {
    departmentsAPI.getAll.mockResolvedValueOnce([]);
    departmentsAPI.create.mockRejectedValueOnce(new Error("Failed"));
    
    render(<DepartmentsPage />);
    await waitFor(() => expect(departmentsAPI.getAll).toHaveBeenCalled());
    
    fireEvent.click(screen.getByText(/New Department/i));
    fireEvent.change(screen.getByPlaceholderText("e.g., Engineering, Marketing"), { target: { value: "Fail Dept" } });
    fireEvent.click(screen.getByText("Create Department", { selector: 'button' }));
    
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Error creating department: Failed"));
  });

  it("handles department deletion", async () => {
    departmentsAPI.getAll.mockResolvedValue(mockDepartments);
    departmentsAPI.delete.mockResolvedValueOnce({});
    
    render(<DepartmentsPage />);
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());
    
    const deleteButtons = document.querySelectorAll('.text-red-600');
    fireEvent.click(deleteButtons[0]);
    
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(departmentsAPI.delete).toHaveBeenCalledWith("Engineering"));
    // getAll called initially + after deletion
    expect(departmentsAPI.getAll).toHaveBeenCalledTimes(2);
  });

  it("handles department deletion failure", async () => {
    departmentsAPI.getAll.mockResolvedValue(mockDepartments);
    departmentsAPI.delete.mockRejectedValueOnce(new Error("Delete failed"));
    
    render(<DepartmentsPage />);
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());
    
    const deleteButtons = document.querySelectorAll('.text-red-600');
    fireEvent.click(deleteButtons[0]);
    
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Error deleting department: Delete failed"));
  });

  it("filters departments by search", async () => {
    departmentsAPI.getAll.mockResolvedValue(mockDepartments);
    render(<DepartmentsPage />);
    
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());
    
    fireEvent.change(screen.getByPlaceholderText("Search departments..."), { target: { value: "Empty" } });
    
    expect(screen.queryByText("Engineering")).not.toBeInTheDocument();
    expect(screen.getByText("Empty Dept")).toBeInTheDocument();
    
    // No results view
    fireEvent.change(screen.getByPlaceholderText("Search departments..."), { target: { value: "XYZ" } });
    expect(screen.getByText("No departments found")).toBeInTheDocument();
  });

  it("expands and collapses department to show employees with complex skills", async () => {
    departmentsAPI.getAll.mockResolvedValue(mockDepartments);
    render(<DepartmentsPage />);
    
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());
    
    // Click header to expand
    fireEvent.click(screen.getByText("Engineering").closest('button'));
    
    // Check employee e1
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(document.querySelector('img[src="http://example.com/img.jpg"]')).toBeInTheDocument();
    
    // Check employee e2 with > 3 skills (shows +1)
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("No position")).toBeInTheDocument();
    expect(screen.getByText("Java")).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
    
    // Click Empty Dept
    fireEvent.click(screen.getByText("Empty Dept").closest('button'));
    expect(screen.getByText("No employees in this department")).toBeInTheDocument();
  });
  
  it("adapts layout for dark mode and non-admin", async () => {
    useTheme.mockReturnValue({ darkMode: true });
    useAuth.mockReturnValue({ user: { role: "EMPLOYEE" } }); // Can't manage
    departmentsAPI.getAll.mockResolvedValue([]);
    
    render(<DepartmentsPage />);
    await waitFor(() => expect(screen.getByText("Departments")).toBeInTheDocument());
    
    // Verify New Department is hidden
    expect(screen.queryByText(/New Department/i)).not.toBeInTheDocument();
  });
});
