import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import User from "../models/User";
import { publicUser } from "../utils/serializers";
import { createHash } from "node:crypto";
import RevokedToken from "../models/RevokedToken";
import { requireAuth, type AuthRequest } from "../middleware/auth";
const router = Router();
const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  email: emailSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72),
});
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});
function issueToken(userId: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret)
    throw new Error("Authentication is not configured on the server.");
  return jwt.sign({}, secret, { subject: userId, expiresIn: "7d" });
}
router.post("/register", async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        message:
          parsed.error.issues[0]?.message || "Please check your details.",
      });
    const { name, email, password } = parsed.data;
    if (await User.exists({ email }))
      return res.status(409).json({
        message: "An account with this email already exists. Please log in.",
      });
    const user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
    });
    return res
      .status(201)
      .json({ token: issueToken(String(user._id)), user: publicUser(user) });
  } catch (error: any) {
    if (error?.code === 11000)
      return res.status(409).json({
        message: "An account with this email already exists. Please log in.",
      });
    next(error);
  }
});
router.post("/logout", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const token = req.header("authorization")!.slice(7);
    const secret = process.env.JWT_SECRET!;
    const payload = jwt.verify(token, secret) as jwt.JwtPayload;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(
      (payload.exp || Math.floor(Date.now() / 1000) + 3600) * 1000,
    );
    await RevokedToken.updateOne(
      { tokenHash },
      { $setOnInsert: { tokenHash, expiresAt } },
      { upsert: true },
    );
    return res.json({ message: "You have been signed out." });
  } catch (error) {
    next(error);
  }
});
router.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ message: "Enter a valid email and password." });
    const user = await User.findOne({ email: parsed.data.email }).select(
      "+passwordHash",
    );
    if (
      !user ||
      !(await bcrypt.compare(parsed.data.password, user.passwordHash))
    )
      return res
        .status(401)
        .json({ message: "Email or password is incorrect." });
    return res.json({
      token: issueToken(String(user._id)),
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
});
export default router;
