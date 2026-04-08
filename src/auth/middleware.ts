import { Request, Response, NextFunction } from "express";
import { verifyToken } from "./jwt.js";
import { getUserRoleInWorkspace } from "../db/workspaces.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      workspaceId?: string;
      workspaceRole?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.userId = payload.userId;
  next();
}

export function requireWorkspaceMember() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    requireAuth(req, res, async () => {
      const workspaceId = req.params.id;
      const role = await getUserRoleInWorkspace(workspaceId, req.userId!);
      if (!role) {
        res.status(403).json({ error: "Not a member of this workspace" });
        return;
      }
      req.workspaceId = workspaceId;
      req.workspaceRole = role;
      next();
    });
  };
}

export function requireWorkspaceAdmin() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    requireAuth(req, res, async () => {
      const workspaceId = req.params.id;
      const role = await getUserRoleInWorkspace(workspaceId, req.userId!);
      if (role !== "admin") {
        res.status(403).json({ error: "Admin access required" });
        return;
      }
      req.workspaceId = workspaceId;
      req.workspaceRole = role;
      next();
    });
  };
}
