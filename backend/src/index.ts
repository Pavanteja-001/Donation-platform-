import "dotenv/config";
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

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`DonationPlatform backend listening on http://localhost:${PORT}`);
});
