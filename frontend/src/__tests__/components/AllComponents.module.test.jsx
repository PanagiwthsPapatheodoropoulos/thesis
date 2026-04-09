import { describe, it, expect } from "vitest";

const componentModules = [
  "../../components/AIAssignmentModal.jsx",
  "../../components/ChatbotWidget.jsx",
  "../../components/EmployeeProductivityChart.jsx",
  "../../components/MainLayout.jsx",
  "../../components/Pagination.jsx",
  "../../components/ProtectedRoute.jsx",
  "../../components/SkillRadarChart.jsx",
  "../../components/SkillsInput.jsx",
  "../../components/SkillsMultiSelect.jsx",
  "../../components/TaskComplexityAnalyzer.jsx",
  "../../components/TaskDetailsModal.jsx",
  "../../components/TaskDurationPredictor.jsx",
  "../../components/TaskSkillsExtractor.jsx",
  "../../components/WorkloadHeatmap.jsx",
];

describe("all components modules", () => {
  it("loads every component module", async () => {
    for (const path of componentModules) {
      const mod = await import(path);
      const exported = mod.default ?? Object.values(mod)[0];
      expect(exported).toBeTruthy();
    }
  });
});

