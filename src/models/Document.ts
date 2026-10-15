import { Schema, model, models } from "mongoose";
const shareSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["viewer", "editor"],
      default: "viewer",
      required: true,
    },
  },
  { _id: false },
);
const documentSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 160,
      default: "Untitled document",
    },
    content: {
      type: Schema.Types.Mixed,
      required: true,
      default: () => ({ type: "doc", content: [{ type: "paragraph" }] }),
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    shares: { type: [shareSchema], default: [] },
  },
  { timestamps: true, minimize: false },
);
documentSchema.index({ owner: 1, updatedAt: -1 });
export default models.Document || model("Document", documentSchema);
