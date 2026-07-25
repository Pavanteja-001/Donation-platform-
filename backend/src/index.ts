import "dotenv/config";
// Patches Express to forward rejected promises from async route handlers to error-handling
// middleware — without this, an error thrown/rejected inside an `async (req, res) => {...}`
// handler (e.g. a dropped DB connection) becomes an unhandled rejection and crashes the whole
// process, taking down every in-flight request, not just the one that failed. Must be imported
// before the routes that use it.
import "express-async-errors";
import cors from "cors";
import express from "express";
import authRoutes from "./routes/auth";
import adminRoutes from "./routes/admin";
import needsRoutes from "./routes/needs";
import contributionsRoutes from "./routes/contributions";
import uploadsRoutes from "./routes/uploads";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/needs", needsRoutes);
app.use("/api/contributions", contributionsRoutes);
app.use("/api/uploads", uploadsRoutes);

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
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`DonationPlatform backend listening on http://localhost:${PORT}`);
});
