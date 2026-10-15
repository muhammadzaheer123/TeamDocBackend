import mongoose from "mongoose";
import { createApp } from "../src/app";

let connectionPromise: Promise<typeof mongoose> | undefined;

async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing in Vercel environment variables.");
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET is missing or too short.");
  }

  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
      })
      .catch((error) => {
        connectionPromise = undefined;
        throw error;
      });
  }

  await connectionPromise;
}

const app = createApp();

export default async function handler(req: any, res: any) {
  try {
    await connectDatabase();
    return app(req, res);
  } catch (error) {
    console.error(
      "API startup failed:",
      error instanceof Error ? error.message : error,
    );

    return res.status(500).json({
      message: "Database connection failed. Check server logs.",
    });
  }
}
