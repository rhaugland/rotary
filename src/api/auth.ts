import { Router } from "express";
import { findUserByAddress, getUserWithAddresses } from "../db/users.js";
import { createMagicLink, validateAndConsumeMagicLink } from "../db/magic-links.js";
import { getWorkspacesForUser } from "../db/workspaces.js";
import { getAdapter } from "../adapters/index.js";
import { signToken } from "../auth/jwt.js";
import { requireAuth } from "../auth/middleware.js";

export const authRouter = Router();

authRouter.post("/request", async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) {
      res.status(400).json({ error: "address is required" });
      return;
    }

    const user = await findUserByAddress(address);
    if (user) {
      const link = await createMagicLink(user.id);
      const loginUrl = `${req.protocol}://${req.get("host")}/dashboard/verify/${link.token}`;
      const preferredAddress = user.addresses.find((a) => a.channel === user.preferredChannel);
      if (preferredAddress) {
        try {
          const adapter = getAdapter(user.preferredChannel);
          await adapter.sendMessage(preferredAddress.address, `Your Relay login link: ${loginUrl}`);
        } catch (error) {
          console.error("Failed to send magic link:", error);
        }
      }
    }

    // Always return sent: true to prevent user enumeration
    res.json({ sent: true });
  } catch (error) {
    console.error("Auth request error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

authRouter.post("/verify", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ error: "token is required" });
      return;
    }

    const user = await validateAndConsumeMagicLink(token);
    if (!user) {
      res.status(401).json({ error: "Invalid or expired login link" });
      return;
    }

    const jwt = signToken(user.id);
    res.json({ token: jwt, user: { id: user.id, name: user.name } });
  } catch (error) {
    console.error("Auth verify error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await getUserWithAddresses(req.userId!);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const workspaces = await getWorkspacesForUser(req.userId!);
    res.json({
      id: user.id,
      name: user.name,
      preferredChannel: user.preferredChannel,
      workspaces: workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        role: w.role,
      })),
    });
  } catch (error) {
    console.error("Auth me error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});
