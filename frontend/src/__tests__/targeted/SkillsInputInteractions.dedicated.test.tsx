// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({ darkMode: true }),
}));

import SkillsInput from "../../components/SkillsInput";

describe("SkillsInput interactions", () => {
  beforeEach(() => {
    window.alert = vi.fn();
    localStorage.setItem("token", "t");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("adds and removes temporary skills without employeeId", async () => {
    const onSkillsChange = vi.fn();
    render(<SkillsInput onSkillsChange={onSkillsChange} initialSkills={[]} />);

    fireEvent.click(screen.getByText(/Add Skill/i));
    fireEvent.change(screen.getByPlaceholderText("e.g., Java, Leadership"), { target: { value: "React" } });
    fireEvent.click(screen.getAllByText("Add Skill").slice(-1)[0]);

    await waitFor(() => expect(onSkillsChange).toHaveBeenCalled());
    expect(screen.getByText(/React/i)).toBeInTheDocument();

    const removeButtons = document.querySelectorAll('button[type="button"]');
    if (removeButtons.length > 0) {
      fireEvent.click(removeButtons[removeButtons.length - 1]);
    }
  });

  it("shows validation alert when skill name empty", async () => {
    render(<SkillsInput onSkillsChange={vi.fn()} initialSkills={[]} />);
    fireEvent.click(screen.getByText(/Add Skill/i));
    fireEvent.click(screen.getAllByText("Add Skill").slice(-1)[0]);
    expect(window.alert).toHaveBeenCalledWith("Please enter a skill name");
  });

  it("handles persistent skill addition with employeeId successfully", async () => {
    const onSkillsChange = vi.fn();
    
    // Setup mock fetch for all the steps
    const fetchMock = vi.fn()
      // 1: Create skill response
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "s1", name: "Java" }) })
      // 2: Add skill to employee response
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "s1", skillName: "Java", proficiencyLevel: 3 }) })
      // 3: Fetch fresh skills response
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ id: "s1", skillName: "Java", proficiencyLevel: 3 }]) });
      
    vi.stubGlobal("fetch", fetchMock);
    
    render(<SkillsInput onSkillsChange={onSkillsChange} initialSkills={[]} employeeId="e1" />);
    
    // Open add input
    fireEvent.click(screen.getByText(/Add Skill/i));
    
    // Type skill
    fireEvent.change(screen.getByPlaceholderText("e.g., Java, Leadership"), { target: { value: "Java" } });
    
    // Click add
    fireEvent.click(screen.getByText("Add Skill", { selector: 'button' }));
    
    // It should add skill and call fetch multiple times
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3), { timeout: 2000 });
    expect(onSkillsChange).toHaveBeenCalledWith([{ id: "s1", skillName: "Java", proficiencyLevel: 3 }]);
  });

  it("handles fallback if fetch fresh skills fails after adding", async () => {
    const onSkillsChange = vi.fn();
    
    const fetchMock = vi.fn()
      // 1: Create skill response (existing triggers 409)
      .mockResolvedValueOnce({ ok: false, status: 409, text: async () => "conflict" })
      // fetch existing skill response
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "s1", name: "Java" }) })
      // 2: Add skill to employee response
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "s1", skillName: "Java", proficiencyLevel: 3 }) })
      // 3: Fetch fresh skills fails
      .mockResolvedValueOnce({ ok: false });
      
    vi.stubGlobal("fetch", fetchMock);
    
    render(<SkillsInput onSkillsChange={onSkillsChange} initialSkills={[]} employeeId="e1" />);
    fireEvent.click(screen.getByText(/Add Skill/i));
    fireEvent.change(screen.getByPlaceholderText("e.g., Java, Leadership"), { target: { value: "Java" } });
    
    // Submits on Enter key press
    fireEvent.keyDown(screen.getByPlaceholderText("e.g., Java, Leadership"), { key: 'Enter', code: 'Enter' });
    
    await waitFor(() => expect(onSkillsChange).toHaveBeenCalled(), { timeout: 2000 });
  });

  it("handles persistent skill removal with employeeId successfully", async () => {
    const onSkillsChange = vi.fn();
    
    const fetchMock = vi.fn()
      // 1: Delete response
      .mockResolvedValueOnce({ ok: true })
      // 2: Fetch fresh skills
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
      
    vi.stubGlobal("fetch", fetchMock);
    
    render(<SkillsInput 
      onSkillsChange={onSkillsChange} 
      initialSkills={[{ id: "123", skillId: "123", skillName: "React", proficiencyLevel: 3, skillCategory: "Web" }]} 
      employeeId="e1" 
    />);
    
    // Wait for render
    await screen.findByText("React");
    
    // Find remove button
    const removeButtons = document.querySelectorAll('button[type="button"]');
    // First remove button
    fireEvent.click(removeButtons[0]);
    
    await waitFor(() => expect(onSkillsChange).toHaveBeenCalledWith([]), { timeout: 2000 });
  });
});

