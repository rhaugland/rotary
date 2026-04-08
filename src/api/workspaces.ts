import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { requireWorkspaceMember } from "../auth/middleware.js";
import {
  createWorkspace,
  getWorkspacesForUser,
  getMembersOfWorkspace,
} from "../db/workspaces.js";
import { getPrisma } from "../db/client.js";

export const workspacesRouter = Router();

// Create workspace
workspacesRouter.post("/", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const workspace = await createWorkspace({ name, creatorId: req.userId! });
    res.status(201).json({ id: workspace.id, name: workspace.name, slug: workspace.slug });
  } catch (error) {
    console.error("Create workspace error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// List user's workspaces
workspacesRouter.get("/", requireAuth, async (req, res) => {
  try {
    const workspaces = await getWorkspacesForUser(req.userId!);
    res.json(workspaces.map((w) => ({ id: w.id, name: w.name, slug: w.slug, role: w.role })));
  } catch (error) {
    console.error("List workspaces error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// Dashboard stats
workspacesRouter.get("/:id/dashboard", requireWorkspaceMember(), async (req, res) => {
  try {
    const prisma = getPrisma();
    const workspaceId = req.params.id;

    const [openTasks, overdueTasks, completedTasks, memberCount, recentTasks, recentActivity] = await Promise.all([
      prisma.task.count({ where: { workspaceId, status: { in: ["open", "in_progress"] } } }),
      prisma.task.count({ where: { workspaceId, status: "overdue" } }),
      prisma.task.count({ where: { workspaceId, status: "done" } }),
      prisma.workspaceMember.count({ where: { workspaceId } }),
      prisma.task.findMany({
        where: { workspaceId },
        include: { assignee: true, creator: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.message.findMany({
        where: { task: { workspaceId } },
        include: { user: true, task: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    res.json({ openTasks, overdueTasks, completedTasks, memberCount, recentTasks, recentActivity });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// Tasks list (filterable)
workspacesRouter.get("/:id/tasks", requireWorkspaceMember(), async (req, res) => {
  try {
    const prisma = getPrisma();
    const workspaceId = req.params.id;
    const status = req.query.status as string | undefined;
    const assignee = req.query.assignee as string | undefined;

    const where: any = { workspaceId };
    if (status) where.status = status;
    if (assignee) where.assigneeId = assignee;

    const tasks = await prisma.task.findMany({
      where,
      include: { assignee: true, creator: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(tasks);
  } catch (error) {
    console.error("Tasks list error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// Members list
workspacesRouter.get("/:id/members", requireWorkspaceMember(), async (req, res) => {
  try {
    const members = await getMembersOfWorkspace(req.params.id);
    res.json(members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      role: m.role,
      preferredChannel: m.user.preferredChannel,
      joinedAt: m.joinedAt,
    })));
  } catch (error) {
    console.error("Members list error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// My tasks (current user only)
workspacesRouter.get("/:id/my-tasks", requireWorkspaceMember(), async (req, res) => {
  try {
    const prisma = getPrisma();
    const tasks = await prisma.task.findMany({
      where: { workspaceId: req.params.id, assigneeId: req.userId },
      include: { creator: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(tasks);
  } catch (error) {
    console.error("My tasks error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// Activity feed
workspacesRouter.get("/:id/activity", requireWorkspaceMember(), async (req, res) => {
  try {
    const prisma = getPrisma();
    const messages = await prisma.message.findMany({
      where: { task: { workspaceId: req.params.id } },
      include: { user: true, task: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(messages);
  } catch (error) {
    console.error("Activity error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});
