import { describe, it, expect } from "vitest";
import {
  getActiveTaskForUser,
  setActiveTaskForUser,
  clearActiveTaskForUser,
  formatDisambiguationMessage,
} from "../../src/router/threading.js";

describe("Conversation threading", () => {
  it("stores and retrieves active task for a user", () => {
    setActiveTaskForUser("user-1", "task-123");
    const activeTask = getActiveTaskForUser("user-1");
    expect(activeTask).toBe("task-123");
  });

  it("returns null when no active task is set", () => {
    const activeTask = getActiveTaskForUser("nonexistent-user");
    expect(activeTask).toBeNull();
  });

  it("clears active task", () => {
    setActiveTaskForUser("user-2", "task-456");
    clearActiveTaskForUser("user-2");
    expect(getActiveTaskForUser("user-2")).toBeNull();
  });

  it("formats disambiguation message", () => {
    const msg = formatDisambiguationMessage([
      { id: "1", title: "Finish logo", dueDate: new Date("2026-04-11") },
      { id: "2", title: "Send invoice", dueDate: null },
    ]);
    expect(msg).toContain("Finish logo");
    expect(msg).toContain("Send invoice");
    expect(msg).toContain("1)");
    expect(msg).toContain("2)");
  });
});
