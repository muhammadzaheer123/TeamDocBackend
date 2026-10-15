import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/User";
async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
  await mongoose.connect(process.env.MONGODB_URI);
  const accounts = [
    { name: "Morgan Lee", email: "morgan@example.com" },
    { name: "Taylor Reed", email: "taylor@example.com" },
  ];
  for (const account of accounts) {
    const passwordHash = await bcrypt.hash("TeamDocsDemo2026!", 12);
    await User.updateOne(
      { email: account.email },
      { $setOnInsert: { ...account, passwordHash } },
      { upsert: true },
    );
  }
  console.log(
    "Demo users ready: morgan@example.com and taylor@example.com / TeamDocsDemo2026!",
  );
  await mongoose.disconnect();
}
main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
