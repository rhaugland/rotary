import { Router } from "express";
import { requireWorkspaceAdmin } from "../auth/middleware.js";
import { createInviteLink, validateInvite, consumeInvite, getActiveInvites, deactivateInvite } from "../db/invites.js";
import { addMember } from "../db/workspaces.js";
import { findUserByAddress, createUser } from "../db/users.js";
import { Channel } from "@prisma/client";

export const invitesRouter = Router();

// Admin: create invite link
invitesRouter.post("/workspaces/:id/invites", requireWorkspaceAdmin(), async (req, res) => {
  try {
    const invite = await createInviteLink({
      workspaceId: req.params.id,
      createdById: req.userId!,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
      maxUses: req.body.maxUses,
    });
    const url = `${req.protocol}://${req.get("host")}/dashboard/invite/${invite.token}`;
    res.status(201).json({ id: invite.id, token: invite.token, url, expiresAt: invite.expiresAt, maxUses: invite.maxUses });
  } catch (error) {
    console.error("Create invite error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// Admin: list active invites
invitesRouter.get("/workspaces/:id/invites", requireWorkspaceAdmin(), async (req, res) => {
  try {
    const invites = await getActiveInvites(req.params.id);
    res.json(invites);
  } catch (error) {
    console.error("List invites error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// Admin: deactivate invite
invitesRouter.delete("/workspaces/:id/invites/:inviteId", requireWorkspaceAdmin(), async (req, res) => {
  try {
    await deactivateInvite(req.params.inviteId);
    res.json({ deactivated: true });
  } catch (error) {
    console.error("Deactivate invite error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// Public: validate invite
invitesRouter.get("/invite/:token", async (req, res) => {
  try {
    const result = await validateInvite(req.params.token);
    res.json(result);
  } catch (error) {
    console.error("Validate invite error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// Public: join via invite
invitesRouter.post("/invite/:token/join", async (req, res) => {
  try {
    const { name, preferredChannel, address } = req.body;
    if (!name || !preferredChannel || !address) {
      res.status(400).json({ error: "name, preferredChannel, and address are required" });
      return;
    }

    const validation = await validateInvite(req.params.token);
    if (!validation.valid) {
      res.status(400).json({ error: validation.reason });
      return;
    }

    // Find or create user
    let user = await findUserByAddress(address);
    if (!user) {
      user = await createUser({
        name,
        role: "member",
        preferredChannel: preferredChannel as Channel,
        addresses: [{ channel: preferredChannel as Channel, address }],
      });
    }

    // Add to workspace (upsert prevents duplicates)
    await addMember(validation.workspaceId!, user.id, "member");

    // Consume invite
    await consumeInvite(req.params.token);

    const { getPrisma } = await import("../db/client.js");
    const workspace = await getPrisma().workspace.findUnique({ where: { id: validation.workspaceId! } });

    res.status(201).json({
      user: { id: user.id, name: user.name },
      workspace: { id: workspace!.id, name: workspace!.name, slug: workspace!.slug },
    });
  } catch (error) {
    console.error("Join invite error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});
