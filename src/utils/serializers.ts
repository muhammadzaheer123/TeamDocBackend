import type { Types } from "mongoose";
export function publicUser(user: any) { return { id: String(user._id), name: user.name, email: user.email }; }
export function serializeDocument(doc: any, accessRole: "owner"|"viewer"|"editor") {
  return { _id: String(doc._id), title: doc.title, content: doc.content, owner: doc.owner && typeof doc.owner === "object" ? publicUser(doc.owner) : { id: String(doc.owner), name: "Workspace member", email: "" }, shares: (doc.shares || []).filter((s: any) => s.user && typeof s.user === "object").map((s: any) => ({ user: publicUser(s.user), role: s.role })), createdAt: doc.createdAt, updatedAt: doc.updatedAt, accessRole };
}
export function idString(value: string | Types.ObjectId) { return String(value); }
