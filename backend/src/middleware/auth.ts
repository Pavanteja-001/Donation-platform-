import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { verifyAuthToken, type AuthTokenPayload } from "../lib/jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  try {
    req.user = verifyAuthToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Role-gate a route to one of the given roles (D-018 and PRD §4 roles).
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Missing bearer token" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient role for this action" });
    }
    next();
  };
}
