import "dotenv/config";
import mongoose from "mongoose";
import { createApp } from "./app";
const port = Number(process.env.PORT || 4000);
async function main() {
  if (!process.env.MONGODB_URI)
    throw new Error(
      "MONGODB_URI is required. Copy .env.example to .env and configure MongoDB Atlas.",
    );
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw new Error("JWT_SECRET must be at least 32 characters long.");
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  const app = createApp();
  const server = app.listen(port, () =>
    console.log(`TeamDocs API listening on http://localhost:${port}`),
  );
  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
main().catch((error) => {
  console.error("API startup failed:", error.message);
  process.exit(1);
});
