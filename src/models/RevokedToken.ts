import mongoose, { Schema, type InferSchemaType } from "mongoose";

const revokedTokenSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true },
);

export type RevokedTokenRecord = InferSchemaType<typeof revokedTokenSchema>;
export default mongoose.models.RevokedToken ||
  mongoose.model("RevokedToken", revokedTokenSchema);
