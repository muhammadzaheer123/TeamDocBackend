import { Schema, model, models, type InferSchemaType } from "mongoose";
const userSchema = new Schema({ name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 }, email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 }, passwordHash: { type: String, required: true, select: false } }, { timestamps: true });
export type UserDocument = InferSchemaType<typeof userSchema> & { _id: import("mongoose").Types.ObjectId };
export default models.User || model("User", userSchema);
