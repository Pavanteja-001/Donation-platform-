import "dotenv/config";
// Patches Express to forward rejected promises from async route handlers to error-handling
// middleware — without this, an error thrown/rejected inside an `async (req, res) => {...}`
// handler (e.g. a dropped DB connection) becomes an unhandled rejection and crashes the whole
// process, taking down every in-flight request, not just the one that failed. Must be imported
// before the routes that use it.
import "express-async-errors";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth";
import adminRoutes from "./routes/admin";
import needsRoutes from "./routes/needs";
import contributionsRoutes from "./routes/contributions";
import uploadsRoutes from "./routes/uploads";
import forumRoutes from "./routes/forum";

const app = express();

// PRD §20 — Security & Privacy Pass: HTTP security headers & rate limiting
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());

// Rate limit: 200 requests per 15-minute window per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: "Too many requests from this IP, please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", apiLimiter);

app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/needs", needsRoutes);
app.use("/api/contributions", contributionsRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/forum", forumRoutes);

// Last-resort handler — logs and responds 500 instead of letting the process crash. Route
// handlers should still catch what they can (e.g. the P2002 UTR-uniqueness case), this is the
// backstop for everything else (transient DB drops, bugs).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error("[unhandled]", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong" });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`DonationPlatform backend listening on http://0.0.0.0:${PORT}`);
});
