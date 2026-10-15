import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth";
import documentRoutes from "./routes/documents";
import { requireAuth } from "./middleware/auth";
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());

  const allowedOrigins = (
    process.env.FRONTEND_ORIGIN || "http://localhost:3000"
  )
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""));

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error("Origin is not allowed by CORS."));
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: false,
    }),
  );

  app.use(express.json({ limit: "1mb" }));
  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", service: "teamdocs-api" }),
  );
  app.use(
    "/api/auth",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
    authRoutes,
  );
  app.use("/api/documents", requireAuth, documentRoutes);
  app.use((req, res) => res.status(404).json({ message: "Route not found." }));
  app.use(
    (
      error: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (process.env.NODE_ENV !== "production") console.error(error);
      if (error?.message === "Origin is not allowed by CORS.")
        return res.status(403).json({ message: error.message });
      return res.status(500).json({
        message: "Something went wrong on the server. Please try again.",
      });
    },
  );
  return app;
}

const app = createApp();
export default app;
