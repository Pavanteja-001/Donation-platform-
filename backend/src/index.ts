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
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { createHash } from "node:crypto";
import authRoutes from "./routes/auth";
import adminRoutes from "./routes/admin";
import needsRoutes from "./routes/needs";
import contributionsRoutes from "./routes/contributions";
import uploadsRoutes from "./routes/uploads";
import forumRoutes from "./routes/forum";
import locationRoutes from "./routes/locations";
import notificationRoutes from "./routes/notifications";
import orphanageRoutes from "./routes/orphanages";
import bookingRoutes from "./routes/bookings";
import ngoRoutes from "./routes/ngos";
import volunteerRoutes from "./routes/volunteers";
import statsRoutes from "./routes/stats";
import { startMaintenanceJobs } from "./lib/maintenance";

const app = express();

/**
 * Railway terminates TLS at its edge and forwards to this process, so without this every request
 * arrives carrying the proxy's address. `req.ip` was therefore identical for everyone, and the
 * rate limiter below was handing the WHOLE PLATFORM a single shared bucket — one busy user could
 * lock out every other user on the platform, which is exactly the "too many requests" that showed
 * up in the app.
 *
 * `1`, not `true`: trusting the entire chain lets a client send its own `X-Forwarded-For` and
 * choose its identity, which turns the rate limiter off for anyone who reads this file. One hop
 * is the number of proxies actually in front of us.
 */
app.set("trust proxy", 1);

// PRD §20 — Security & Privacy Pass: HTTP security headers & rate limiting
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: true, // Reflect request origin
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    credentials: true,
  })
);

/**
 * Per-session where possible, per-IP otherwise.
 *
 * Keying purely on IP is wrong for this audience: Indian mobile carriers run large-scale CGNAT,
 * so thousands of real users can share one address. A per-IP bucket would let one heavy user —
 * or simply a busy evening on a single carrier — lock everyone behind that address out of an app
 * people may be opening because they need blood.
 *
 * The bearer token is hashed rather than decoded: this only needs a stable per-session key, not
 * an identity, so there's no reason to verify a signature (and no reason to keep raw tokens in
 * limiter memory). Unauthenticated requests fall back to IP via `ipKeyGenerator`, which
 * normalises IPv6 into a /64 so a single client can't rotate through addresses it already owns.
 */
function sessionOrIpKey(req: express.Request): string {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return `s:${createHash("sha256").update(header.slice(7)).digest("base64url").slice(0, 24)}`;
  }
  return `i:${ipKeyGenerator(req.ip ?? "", 64)}`;
}

/**
 * Whether to skip rate limiting entirely — for local development, where hot reload and repeated
 * screen focus make the limits fire constantly against a single developer.
 *
 * DELIBERATELY OPT-OUT, NOT OPT-IN, AND DELIBERATELY NOT KEYED OFF `NODE_ENV`.
 *
 * Keying this off `NODE_ENV !== "production"` would be the obvious version and the dangerous one:
 * if that variable is ever missing or misspelled on Railway, DDoS protection silently disappears
 * from the live platform and nothing anywhere says so. (Whether it's set in production is already
 * an open question — see L4 in SECURITY_AUDIT.md.)
 *
 * So it takes a deliberate act to turn off, and production refuses regardless.
 */
const rateLimitDisabled =
  process.env.RATE_LIMIT_DISABLED === "true" && process.env.NODE_ENV !== "production";

if (rateLimitDisabled) {
  // Loud, because a server running without rate limiting should never be a quiet surprise.
  // eslint-disable-next-line no-console
  console.warn("⚠️  [rate-limit] DISABLED via RATE_LIMIT_DISABLED — development only, never production.");
} else if (process.env.RATE_LIMIT_DISABLED === "true") {
  // eslint-disable-next-line no-console
  console.warn("[rate-limit] RATE_LIMIT_DISABLED ignored: NODE_ENV=production. Limits stay ON.");
}

/**
 * 600 per 15 minutes ≈ 40/min for one signed-in session.
 *
 * The old 200 was too tight for how the app actually behaves: every return to the home screen
 * refetches the feed, the headline stats and the unread count, so ordinary browsing burns
 * requests in threes. 600 still stops scripted abuse cold while leaving a real person room to
 * browse without ever noticing a limit exists.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  keyGenerator: sessionOrIpKey,
  skip: () => rateLimitDisabled,
  message: { error: "Too many requests, please try again in a few minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * OTP stays strict and stays keyed on IP — an OTP request has no session yet, and every one of
 * them will cost real money once a live SMS provider is wired in (H4).
 *
 * NOTE this is still only a per-IP defence. It does nothing against a distributed script, and a
 * per-PHONE limit plus a lockout is what actually protects the SMS bill. That belongs with the
 * provider integration, not here.
 */
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: "Too many OTP attempts, please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth/otp/", otpLimiter);
app.use("/api/", apiLimiter);

// Enforce 1mb body parser payload ceiling to prevent memory exhaustion DoS attacks
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/needs", needsRoutes);
app.use("/api/contributions", contributionsRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/forum", forumRoutes);
app.use("/api/locations", locationRoutes);
// No per-route limiter on these. `apiLimiter` is already mounted on `/api/` above, and it is the
// same instance — listing it again here made every request to these six paths consume TWO slots
// instead of one. The home screen alone hits notifications and stats on each visit, so it was
// burning the quota at roughly double the intended rate.
app.use("/api/notifications", notificationRoutes);
app.use("/api/orphanages", orphanageRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/ngos", ngoRoutes);
app.use("/api/volunteers", volunteerRoutes);
app.use("/api/stats", statsRoutes);

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
  // Started only once the server is actually accepting requests — serving traffic is the job,
  // housekeeping is not, and a failure to schedule must never prevent the former.
  startMaintenanceJobs();
});
