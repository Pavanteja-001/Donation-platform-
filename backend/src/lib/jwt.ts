import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";

const envSecret = process.env.JWT_SECRET;
if (!envSecret) {
  throw new Error("JWT_SECRET is not set — check backend/.env (see .env.example)");
}
const JWT_SECRET: string = envSecret;

export interface AuthTokenPayload {
  sub: string; // user id
  role: Role;
  phone: string;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}
