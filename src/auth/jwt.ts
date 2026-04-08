import jwt from "jsonwebtoken";
import { config } from "../config.js";

interface JwtPayload {
  userId: string;
}

export function signToken(userId: string): string {
  return jwt.sign({ userId }, config.jwt.secret, { expiresIn: "24h" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    return payload;
  } catch {
    return null;
  }
}
