import { describe, it, expect } from "vitest";
import { signToken, verifyToken } from "../../src/auth/jwt";

describe("signToken", () => {
  it("returns a JWT string", () => {
    const token = signToken("user-123");
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });
});

describe("verifyToken", () => {
  it("returns userId for a valid token", () => {
    const token = signToken("user-456");
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe("user-456");
  });

  it("returns null for an invalid token", () => {
    const payload = verifyToken("garbage.token.here");
    expect(payload).toBeNull();
  });

  it("returns null for a tampered token", () => {
    const token = signToken("user-789");
    const tampered = token.slice(0, -5) + "xxxxx";
    const payload = verifyToken(tampered);
    expect(payload).toBeNull();
  });
});
