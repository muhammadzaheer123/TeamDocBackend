import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import User from "../models/User";
import Document from "../models/Document";
import type { AuthRequest } from "../middleware/auth";
import { canEdit, resolveAccessRole } from "../utils/access";
import { serializeDocument } from "../utils/serializers";
const router = Router();
const contentSchema = z
  .record(z.unknown())
  .refine(
    (value) => value.type === "doc",
    "Document content must be a valid editor document.",
  );
const titleSchema = z
  .string()
  .trim()
  .min(1, "Document title cannot be empty.")
  .max(160, "Document title must be 160 characters or fewer.");
async function loadAccessible(id: string, userId: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await Document.findById(id)
    .populate("owner", "name email")
    .populate("shares.user", "name email");
  if (!doc) return null;
  const role = resolveAccessRole({
    ownerId: String((doc.owner as any)._id || doc.owner),
    userId,
    shares: (doc.shares as any[]).map((share) => ({
      userId: String(share.user?._id || share.user),
      role: share.role,
    })),
  });
  return role ? { doc, role } : null;
}
router.get("/", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const docs = await Document.find({
      $or: [{ owner: userId }, { "shares.user": userId }],
    })
      .sort({ updatedAt: -1 })
      .populate("owner", "name email")
      .populate("shares.user", "name email");
    const documents = docs.map((doc: any) => {
      const role = resolveAccessRole({
        ownerId: String(doc.owner._id),
        userId,
        shares: doc.shares.map((share: any) => ({
          userId: String(share.user._id),
          role: share.role,
        })),
      })!;
      return serializeDocument(doc, role);
    });
    return res.json({ documents });
  } catch (error) {
    next(error);
  }
});
router.post("/", async (req: AuthRequest, res, next) => {
  try {
    let title = "Untitled document";
    if (req.body.title !== undefined) {
      const parsedTitle = titleSchema.safeParse(req.body.title);
      if (!parsedTitle.success)
        return res.status(400).json({
          message:
            parsedTitle.error.issues[0]?.message || "Invalid document title.",
        });
      title = parsedTitle.data;
    }
    let content: Record<string, unknown> = {
      type: "doc",
      content: [{ type: "paragraph" }],
    };
    if (req.body.content !== undefined) {
      const parsedContent = contentSchema.safeParse(req.body.content);
      if (!parsedContent.success)
        return res
          .status(400)
          .json({ message: "Document content must be valid editor content." });
      content = parsedContent.data;
    }
    const doc = await Document.create({ title, content, owner: req.userId });
    const populated = await Document.findById(doc._id)
      .populate("owner", "name email")
      .populate("shares.user", "name email");
    return res
      .status(201)
      .json({ document: serializeDocument(populated, "owner") });
  } catch (error) {
    next(error);
  }
});
router.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const result = await loadAccessible(req.params.id, req.userId!);
    if (!result)
      return res
        .status(404)
        .json({ message: "Document not found or you do not have access." });
    return res.json({
      document: serializeDocument(
        result.doc,
        result.role as "owner" | "viewer" | "editor",
      ),
    });
  } catch (error) {
    next(error);
  }
});
router.patch("/:id", async (req: AuthRequest, res, next) => {
  try {
    const result = await loadAccessible(req.params.id, req.userId!);
    if (!result)
      return res
        .status(404)
        .json({ message: "Document not found or you do not have access." });
    if (!canEdit(result.role))
      return res
        .status(403)
        .json({ message: "You have view-only access to this document." });
    const updates: Record<string, unknown> = {};
    if (req.body.title !== undefined) {
      const parsed = titleSchema.safeParse(req.body.title);
      if (!parsed.success)
        return res.status(400).json({
          message: parsed.error.issues[0]?.message || "Invalid title.",
        });
      updates.title = parsed.data;
    }
    if (req.body.content !== undefined) {
      const parsed = contentSchema.safeParse(req.body.content);
      if (!parsed.success)
        return res
          .status(400)
          .json({ message: "Document content must be valid editor content." });
      updates.content = parsed.data;
    }
    if (!Object.keys(updates).length)
      return res
        .status(400)
        .json({ message: "No document changes were provided." });
    await Document.updateOne({ _id: result.doc._id }, { $set: updates });
    const fresh = await Document.findById(result.doc._id)
      .populate("owner", "name email")
      .populate("shares.user", "name email");
    return res.json({
      document: serializeDocument(
        fresh,
        result.role as "owner" | "viewer" | "editor",
      ),
    });
  } catch (error) {
    next(error);
  }
});
router.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(404).json({ message: "Document not found." });
    const deleted = await Document.findOneAndDelete({
      _id: req.params.id,
      owner: req.userId,
    });
    if (!deleted)
      return res
        .status(404)
        .json({ message: "Document not found or you are not the owner." });
    return res.json({ message: "Document deleted." });
  } catch (error) {
    next(error);
  }
});
router.post("/:id/shares", async (req: AuthRequest, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(404).json({ message: "Document not found." });
    const doc = await Document.findOne({
      _id: req.params.id,
      owner: req.userId,
    });
    if (!doc)
      return res
        .status(404)
        .json({ message: "Only the document owner can manage sharing." });
    const parsed = z
      .object({
        email: z
          .string()
          .trim()
          .email()
          .max(254)
          .transform((v) => v.toLowerCase()),
        role: z.enum(["viewer", "editor"]).default("viewer"),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ message: "Enter a valid email and permission." });
    const target = await User.findOne({ email: parsed.data.email });
    if (!target)
      return res.status(404).json({
        message:
          "No TeamDocs account exists for that email. Ask them to create an account first.",
      });
    if (String(target._id) === String(req.userId))
      return res
        .status(400)
        .json({ message: "You already own this document." });
    const existing = (doc.shares as any[]).find(
      (share) => String(share.user) === String(target._id),
    );
    if (existing) existing.role = parsed.data.role;
    else doc.shares.push({ user: target._id, role: parsed.data.role } as any);
    await doc.save();
    const fresh = await Document.findById(doc._id)
      .populate("owner", "name email")
      .populate("shares.user", "name email");
    return res.json({ document: serializeDocument(fresh, "owner") });
  } catch (error) {
    next(error);
  }
});
router.delete("/:id/shares", async (req: AuthRequest, res, next) => {
  try {
    const parsed = z
      .object({
        email: z
          .string()
          .trim()
          .email()
          .max(254)
          .transform((v) => v.toLowerCase()),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Enter a valid email." });
    const doc = await Document.findOne({
      _id: req.params.id,
      owner: req.userId,
    });
    if (!doc)
      return res
        .status(404)
        .json({ message: "Only the document owner can manage sharing." });
    const target = await User.findOne({ email: parsed.data.email });
    if (!target)
      return res.status(404).json({ message: "Shared user not found." });
    doc.shares = (doc.shares as any).filter(
      (share: any) => String(share.user) !== String(target._id),
    ) as any;
    await doc.save();
    const fresh = await Document.findById(doc._id)
      .populate("owner", "name email")
      .populate("shares.user", "name email");
    return res.json({ document: serializeDocument(fresh, "owner") });
  } catch (error) {
    next(error);
  }
});
export default router;
