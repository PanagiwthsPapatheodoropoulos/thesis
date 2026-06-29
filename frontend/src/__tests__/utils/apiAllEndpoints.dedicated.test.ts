// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  departmentsAPI,
  teamsAPI,
  assignmentsAPI,
  notificationsAPI,
  chatAPI,
  skillsAPI,
  companiesAPI,
  blocklistAPI,
  chatbotAPI,
  taskAttachmentsAPI,
} from "../../utils/api";

describe("utils/api remaining endpoints", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({}),
        text: async () => "",
        status: 200,
        statusText: "OK",
      })
    ));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("calls departmentsAPI endpoints", async () => {
    await departmentsAPI.getAll();
    await departmentsAPI.getByName("IT");
    await departmentsAPI.getDepartmentNames();
    await departmentsAPI.create({});
    await departmentsAPI.delete("IT");
    await departmentsAPI.toggleDevInfo("IT", true);
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it("calls teamsAPI endpoints", async () => {
    await teamsAPI.getAll();
    await teamsAPI.getMyTeams();
    await teamsAPI.getById("t1");
    await teamsAPI.getAllPaginated();
    await teamsAPI.create({});
    await teamsAPI.delete("t1");
    await teamsAPI.update("t1", {});
    expect(fetch).toHaveBeenCalledTimes(7);
  });

  it("calls assignmentsAPI endpoints", async () => {
    await assignmentsAPI.getByEmployee("e1");
    await assignmentsAPI.getByTask("t1");
    await assignmentsAPI.create({ taskId: "t1", employeeId: "e1" });
    await assignmentsAPI.accept("a1");
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("calls notificationsAPI endpoints", async () => {
    await notificationsAPI.getByUser("u1");
    await notificationsAPI.getUnread("u1");
    await notificationsAPI.markAsRead("n1");
    await notificationsAPI.markAllAsRead("u1");
    await notificationsAPI.create({});
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it("calls chatAPI endpoints", async () => {
    await chatAPI.sendMessage({});
    await chatAPI.getTeamMessages("t1");
    await chatAPI.getDirectMessages("u2");
    await chatAPI.getUnreadCount();
    await chatAPI.markAsRead("m1");
    await chatAPI.editMessage("m1", "hi");
    await chatAPI.deleteMessage("m1");
    await chatAPI.getUnreadCountPerContact();
    await chatAPI.getAvailableContacts();
    await chatAPI.getConversations();
    await chatAPI.getUserTeamChats();
    await chatAPI.markAllAsRead();
    expect(fetch).toHaveBeenCalledTimes(12);
  });

  it("calls skillsAPI endpoints", async () => {
    await skillsAPI.getAll();
    await skillsAPI.getById("s1");
    await skillsAPI.getByName("Docker");
    await skillsAPI.getByCategory("DevOps");
    await skillsAPI.create({});
    await skillsAPI.update("s1", {});
    await skillsAPI.delete("s1");
    expect(fetch).toHaveBeenCalledTimes(7);
  });

  it("calls companiesAPI, blocklistAPI, chatbotAPI, and taskAttachmentsAPI", async () => {
    await companiesAPI.getMyCompany();
    await companiesAPI.regenerateJoinCode("c1");
    await blocklistAPI.getAll();
    await blocklistAPI.block("test@email.com");
    await blocklistAPI.unblock("b1");
    await chatbotAPI.query({ query: "hello" });
    await chatbotAPI.health();
    await chatbotAPI.pullModel("phi3");
    await taskAttachmentsAPI.getByTask("t1");
    await taskAttachmentsAPI.upload("t1", new File([], "f.txt"));
    await taskAttachmentsAPI.delete("a1");
    expect(fetch).toHaveBeenCalledTimes(11);
  });
});
