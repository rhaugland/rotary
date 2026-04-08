import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth, requireWorkspaceMember, requireWorkspaceAdmin } from "../../src/auth/middleware";
import { signToken } from "../../src/auth/jwt";

function mockReqResNext(overrides: { headers?: Record<string, string>; params?: Record<string, string> } = {}) {
  const req = {
    headers: overrides.headers ?? {},
    params: overrides.params ?? {},
  } as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe("requireAuth", () => {
  it("calls next and sets req.userId for valid token", () => {
    const token = signToken("user-123");
    const { req, res, next } = mockReqResNext({ headers: { authorization: `Bearer ${token}` } });
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe("user-123");
  });

  it("returns 401 when no authorization header", () => {
    const { req, res, next } = mockReqResNext();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for invalid token", () => {
    const { req, res, next } = mockReqResNext({ headers: { authorization: "Bearer bad-token" } });
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

vi.mock("../../src/db/workspaces.js", () => ({
  getUserRoleInWorkspace: vi.fn(),
}));

import { getUserRoleInWorkspace } from "../../src/db/workspaces";

describe("requireWorkspaceMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls next when user is a member", async () => {
    (getUserRoleInWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue("member");
    const token = signToken("user-123");
    const { req, res, next } = mockReqResNext({ headers: { authorization: `Bearer ${token}` }, params: { id: "ws-1" } });
    const middleware = requireWorkspaceMember();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.workspaceId).toBe("ws-1");
    expect(req.workspaceRole).toBe("member");
  });

  it("returns 403 when user is not a member", async () => {
    (getUserRoleInWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const token = signToken("user-123");
    const { req, res, next } = mockReqResNext({ headers: { authorization: `Bearer ${token}` }, params: { id: "ws-1" } });
    const middleware = requireWorkspaceMember();
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireWorkspaceAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls next when user is an admin", async () => {
    (getUserRoleInWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue("admin");
    const token = signToken("user-123");
    const { req, res, next } = mockReqResNext({ headers: { authorization: `Bearer ${token}` }, params: { id: "ws-1" } });
    const middleware = requireWorkspaceAdmin();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("returns 403 when user is a member but not admin", async () => {
    (getUserRoleInWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue("member");
    const token = signToken("user-123");
    const { req, res, next } = mockReqResNext({ headers: { authorization: `Bearer ${token}` }, params: { id: "ws-1" } });
    const middleware = requireWorkspaceAdmin();
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
