import express from "express";
import path from "path";
import { config } from "./config.js";
import { getPrisma } from "./db/client.js";
import { initAdapters, getAdapter } from "./adapters/index.js";
import { handleInboundMessage } from "./router/router.js";
import { startScheduler } from "./scheduler/scheduler.js";
import { authRouter } from "./api/auth.js";
import { workspacesRouter } from "./api/workspaces.js";
import { invitesRouter } from "./api/invites.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// SMS Webhook (Telnyx)
app.post("/webhooks/sms", async (req, res) => {
  try {
    const adapter = getAdapter("sms");
    const isValid = adapter.verifyWebhook({
      headers: req.headers as Record<string, string | string[] | undefined>,
      body: req.body,
      url: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
    });
    if (!isValid && config.nodeEnv === "production") {
      res.status(403).json({ error: "Invalid webhook signature" });
      return;
    }
    const inbound = adapter.receiveMessage(req.body);
    await handleInboundMessage(inbound);
    res.type("text/xml").send("<Response></Response>");
  } catch (error) {
    console.error("SMS webhook error:", error);
    res.status(500).type("text/xml").send("<Response></Response>");
  }
});

// Email Webhook (SendGrid Inbound Parse)
app.post("/webhooks/email", async (req, res) => {
  try {
    const adapter = getAdapter("email");
    const inbound = adapter.receiveMessage(req.body);
    await handleInboundMessage(inbound);
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Email webhook error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// Google Chat Webhook
app.post("/webhooks/google-chat", async (req, res) => {
  try {
    const adapter = getAdapter("google_chat");
    const isValid = adapter.verifyWebhook({
      headers: req.headers as Record<string, string | string[] | undefined>,
      body: req.body,
    });
    if (!isValid && config.nodeEnv === "production") {
      res.status(403).json({ error: "Invalid webhook" });
      return;
    }
    if (req.body.type !== "MESSAGE") { res.json({}); return; }
    const inbound = adapter.receiveMessage(req.body);
    await handleInboundMessage(inbound);
    res.json({});
  } catch (error) {
    console.error("Google Chat webhook error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// Admin API
app.get("/api/tasks", async (_req, res) => {
  try {
    const tasks = await getPrisma().task.findMany({ include: { assignee: true, creator: true }, orderBy: { createdAt: "desc" } });
    res.json(tasks);
  } catch (error) { console.error("Failed to list tasks:", error); res.status(500).json({ error: "Internal error" }); }
});

app.get("/api/users", async (_req, res) => {
  try {
    const users = await getPrisma().user.findMany({ include: { addresses: true } });
    res.json(users);
  } catch (error) { console.error("Failed to list users:", error); res.status(500).json({ error: "Internal error" }); }
});

app.post("/api/users", async (req, res) => {
  try {
    const { name, role, preferredChannel, addresses } = req.body;
    if (!name || !preferredChannel || !addresses || addresses.length === 0) {
      res.status(400).json({ error: "name, preferredChannel, and addresses are required" });
      return;
    }
    const user = await getPrisma().user.create({
      data: { name, role: role ?? "member", preferredChannel, addresses: { create: addresses } },
      include: { addresses: true },
    });
    res.status(201).json(user);
  } catch (error) { console.error("Failed to create user:", error); res.status(500).json({ error: "Internal error" }); }
});

// Auth API
app.use("/api/auth", authRouter);

// Workspace API
app.use("/api/workspaces", workspacesRouter);

// Invite API (mixed auth — some routes public, some admin)
app.use("/api", invitesRouter);

// Serve dashboard static files
const dashboardPath = path.join(process.cwd(), "dashboard", "dist");
app.use("/dashboard", express.static(dashboardPath));
app.get("/dashboard/*", (_req, res) => {
  res.sendFile(path.join(dashboardPath, "index.html"));
});

// Start server
async function main() {
  initAdapters({ telnyx: config.telnyx, resend: config.resend, googleChat: config.googleChat });
  await startScheduler(config.redisUrl);
  app.listen(config.port, () => console.log(`Relay server running on port ${config.port}`));
}

main().catch((error) => { console.error("Failed to start server:", error); process.exit(1); });

export { app };
