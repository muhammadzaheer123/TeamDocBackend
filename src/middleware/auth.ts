import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { createHash } from "node:crypto";
import RevokedToken from "../models/RevokedToken";
export type AuthRequest = Request & { userId?: string };
export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer "))
    return res.status(401).json({ message: "Please sign in to continue." });
  const token = header.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret)
    return res
      .status(500)
      .json({ message: "Authentication is not configured on the server." });
  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload;
    if (typeof payload.sub !== "string") throw new Error("Invalid token");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    if (await RevokedToken.exists({ tokenHash }))
      return res
        .status(401)
        .json({ message: "Your session has ended. Please sign in again." });
    req.userId = payload.sub;
    return next();
  } catch (error) {
    if (error instanceof Error && error.name === "MongoServerError")
      return res
        .status(503)
        .json({ message: "Session verification is temporarily unavailable." });
    return res
      .status(401)
      .json({ message: "Your session has expired. Please sign in again." });
  }
}
