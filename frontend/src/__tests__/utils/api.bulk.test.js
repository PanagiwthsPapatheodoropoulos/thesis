import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import * as api from "../../utils/api";

describe("utils/api bulk coverage", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("token", "t");
    localStorage.setItem("companyId", "c1");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("calls most API helpers/endpoints once", async () => {
    fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({}),
      text: async () => "",
      status: 200,
      statusText: "OK",
    });

    // helpers
    api.incrementProfileImageVersion();
    expect(api.getProfileImageUrl("http://x")).toContain("?v=");

    // auth
    await api.authAPI.login({ email: "a@b.com", password: "p" });
    await api.authAPI.register({ username: "u", email: "a@b.com", password: "p" });
    await api.authAPI.refreshToken();
    await api.authAPI.registerCompany({
      companyName: "C",
      adminUsername: "a",
      adminEmail: "a@b.com",
      adminPassword: "p",
    });

    // users
    await api.usersAPI.getAll();
    await api.usersAPI.getById("1");
    await api.usersAPI.update("1", { email: "x@y.com" });

    // tasks
    await api.tasksAPI.getAll();
    await api.tasksAPI.getById("1");
    await api.tasksAPI.getByStatus("PENDING");
    await api.tasksAPI.getAllPaginated(1, 10, "createdAt", "asc", {
      status: "PENDING",
      priority: "HIGH",
      search: "x",
    });
    await api.tasksAPI.create({ title: "t" });
    await api.tasksAPI.requestTask({ title: "t" });
    await api.tasksAPI.approveTask("1");
    await api.tasksAPI.update("1", { title: "t2" });
    await api.tasksAPI.delete("1");
    await api.tasksAPI.archive("1");
    await api.tasksAPI.getArchived();
    await api.tasksAPI.updateStatus("1", "COMPLETED");
    await api.tasksAPI.getTaskRequests();
    await api.tasksAPI.rejectTask("1");
    await api.tasksAPI.canEdit("1");
    await api.tasksAPI.canDelete("1");

    // comments/audit/time
    await api.taskCommentsAPI.getByTask("1");
    await api.taskCommentsAPI.create({ taskId: "1", text: "x" });
    await api.taskCommentsAPI.delete("1");
    await api.taskCommentsAPI.getCount("1");
    await api.taskAuditAPI.getHistory("1");
    await api.taskTimeAPI.logTime({ taskId: "1", hours: 1, description: "x" });
    await api.taskTimeAPI.getByTask("1");
    await api.taskTimeAPI.getTotalHours("1");

    // employees
    await api.employeesAPI.getAll();
    await api.employeesAPI.getById("1");
    await api.employeesAPI.getByUserId("1");
    await api.employeesAPI.getAllPaginated(0, 20, "firstName", "asc", {
      department: "Engineering",
      position: "Dev",
      search: "x",
    });
    await api.employeesAPI.create({ firstName: "x" });
    await api.employeesAPI.update("1", { firstName: "y" });

    // getSkills branch: array
    fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ["Java"],
      text: async () => "",
      status: 200,
      statusText: "OK",
    });
    expect(await api.employeesAPI.getSkills("1")).toEqual(["Java"]);

    // getSkills branch: { skills: [] }
    fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ skills: ["React"] }),
      text: async () => "",
      status: 200,
      statusText: "OK",
    });
    expect(await api.employeesAPI.getSkills("1")).toEqual(["React"]);

    // departments/teams/assignments/notifications/chat/skills
    await api.departmentsAPI.getAll();
    await api.departmentsAPI.getByName("Engineering");
    await api.departmentsAPI.getDepartmentNames();
    await api.departmentsAPI.create({ name: "Eng" });

    await api.teamsAPI.getAll();
    await api.teamsAPI.getMyTeams();
    await api.teamsAPI.getById("1");
    await api.teamsAPI.getAllPaginated(0, 10, "name", "asc", { q: "x" });
    await api.teamsAPI.create({ name: "T" });

    await api.assignmentsAPI.getByEmployee("1");
    await api.assignmentsAPI.getByTask("1");
    await api.assignmentsAPI.create({ taskId: "1", employeeId: "2" });
    await api.assignmentsAPI.accept("1");

    await api.notificationsAPI.getByUser("1");
    await api.notificationsAPI.getUnread("1");
    await api.notificationsAPI.markAsRead("1");
    await api.notificationsAPI.markAllAsRead("1");
    await api.notificationsAPI.create({ type: "x" });

    await api.chatAPI.sendMessage({ body: "x" });
    await api.chatAPI.getTeamMessages("1");
    await api.chatAPI.getDirectMessages("1");
    await api.chatAPI.getUnreadCount();
    await api.chatAPI.markAsRead("1");
    await api.chatAPI.getUnreadCountPerContact();
    await api.chatAPI.getAvailableContacts();
    await api.chatAPI.getConversations();
    await api.chatAPI.getUserTeamChats();
    await api.chatAPI.markAllAsRead();

    await api.skillsAPI.getAll();
    await api.skillsAPI.getById("1");
    await api.skillsAPI.getByName("Java");
    await api.skillsAPI.getByCategory("Backend");
    await api.skillsAPI.create({ name: "x" });
    await api.skillsAPI.update("1", { name: "y" });

    // ai + chatbot
    await api.aiAPI.getAssignmentSuggestions({ taskId: "1" });
    await api.aiAPI.predictDuration({ taskId: "1" });
    await api.aiAPI.getEmployeeSkillsBatch(["1", "2"]);
    await api.aiAPI.getTaskSkillsBatch(["1", "2"]);
    await api.aiAPI.getProductivityAnalytics(7, true);
    await api.aiAPI.bulkOptimize({ taskIds: ["1"] });
    await api.aiAPI.triggerRetraining(true);
    await api.aiAPI.getModelInfo();
    await api.aiAPI.extractSkillsFromText({ text: "x" });
    await api.aiAPI.analyzeTaskComplexity({ text: "x" });
    await api.aiAPI.suggestTeamSkills({ teamId: "1" });
    await api.aiAPI.getSkillCategories();
    await api.aiAPI.batchExtractSkills([{ title: "t" }]);

    await api.chatbotAPI.query({ query: "x" });
    await api.chatbotAPI.health();
    await api.chatbotAPI.pullModel("phi3");
  });
});

