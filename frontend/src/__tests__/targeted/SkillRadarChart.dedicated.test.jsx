import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SkillRadarChart from "../../components/SkillRadarChart.jsx";

// Mock Chart.js to avoid canvas context errors
vi.mock("chart.js", () => {
  return {
    Chart: class {
      constructor(ctx, config) {
        this.ctx = ctx;
        this.config = config;
      }
      destroy() {}
      update() {}
      static register() {}
    },
    RadarController: vi.fn(),
    RadialLinearScale: vi.fn(),
    PointElement: vi.fn(),
    LineElement: vi.fn(),
    Filler: vi.fn(),
    Tooltip: vi.fn(),
    Legend: vi.fn(),
  };
});

describe("SkillRadarChart coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no skills are provided", () => {
    render(<SkillRadarChart skills={[]} darkMode={false} />);
    expect(screen.getByText("No Skills Available")).toBeInTheDocument();
    expect(screen.getByText("Add skills to see the radar chart")).toBeInTheDocument();
  });

  it("renders empty state in dark mode", () => {
    const { container } = render(<SkillRadarChart skills={null} darkMode={true} />);
    expect(screen.getByText("No Skills Available")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("bg-gray-800");
  });

  it("renders chart and skill list correctly (<=6 skills)", () => {
    const minSkills = [
      { skillName: "React", proficiencyLevel: 4 },
      { name: "Node.js", proficiencyLevel: 3 }, // testing fallback name
      { skillName: "CSS", proficiencyLevel: 6 }, // testing max cap (should clamp to 5 internally)
    ];

    render(<SkillRadarChart skills={minSkills} darkMode={false} title="My Skills" />);
    
    expect(screen.getByText("My Skills")).toBeInTheDocument();
    expect(screen.getByText("Total Skills:")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("4/5")).toBeInTheDocument();
    expect(screen.getByText("Node.js")).toBeInTheDocument();
    expect(screen.getByText("3/5")).toBeInTheDocument();
    // It clamps internally in the chart data, but checking the displayed text:
    // Wait, the display code says: {skill.proficiencyLevel || 0}/5
    expect(screen.getByText("6/5")).toBeInTheDocument(); 

    // With <=6 skills, the "Show All" button should NOT be there
    expect(screen.queryByText(/Show All/)).not.toBeInTheDocument();
  });

  it("renders chart with dark mode", () => {
    const minSkills = [{ skillName: "React", proficiencyLevel: 4 }];
    const { container } = render(<SkillRadarChart skills={minSkills} darkMode={true} />);
    
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("bg-gray-800");
  });

  it("handles >6 skills and toggles Show All / Show Less", () => {
    const manySkills = [
      { skillName: "Skill 1", proficiencyLevel: 1 },
      { skillName: "Skill 2", proficiencyLevel: 2 },
      { skillName: "Skill 3", proficiencyLevel: 3 },
      { skillName: "Skill 4", proficiencyLevel: 4 },
      { skillName: "Skill 5", proficiencyLevel: 5 },
      { skillName: "Skill 6", proficiencyLevel: 5 },
      { skillName: "Skill 7", proficiencyLevel: 1 },
    ];

    render(<SkillRadarChart skills={manySkills} darkMode={false} />);
    
    // Initially, only 6 are shown
    expect(screen.getByText("Skill 1")).toBeInTheDocument();
    expect(screen.getByText("Skill 6")).toBeInTheDocument();
    expect(screen.queryByText("Skill 7")).not.toBeInTheDocument();
    
    // Toggle button should be showing "Show All 7 Skills"
    const toggleButton = screen.getByText("Show All 7 Skills");
    expect(toggleButton).toBeInTheDocument();
    
    // Click to show all
    fireEvent.click(toggleButton);
    expect(screen.getByText("Skill 7")).toBeInTheDocument();
    expect(screen.getByText("Show Less")).toBeInTheDocument();
    
    // Click to show less
    fireEvent.click(screen.getByText("Show Less"));
    expect(screen.queryByText("Skill 7")).not.toBeInTheDocument();
    expect(screen.getByText("Show All 7 Skills")).toBeInTheDocument();
  });
  
  it("handles skill with no proficiency level gracefully", () => {
    const invalidSkill = [{ skillName: "Mystery" }];
    render(<SkillRadarChart skills={invalidSkill} />);
    
    expect(screen.getByText("Mystery")).toBeInTheDocument();
    expect(screen.getByText("0/5")).toBeInTheDocument(); // Falls back to 0
  });
});
