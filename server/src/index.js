import "dotenv/config";
import express from "express";
import cors from "cors";
import appStateRouter from "./routes/appState.js";
import poRouter from "./routes/po.js";

const app = express();
const PORT = process.env.PORT || 4000;

// ── CORS ────────────────────────────────────────────────────
// Allow the configured origins (GitHub Pages + localhost dev).
const allowedOrigins = (process.env.ALLOWED_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g. curl, server-to-server).
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin '${origin}' not allowed`));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// ── Health check ────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true }));

// ── Routes ──────────────────────────────────────────────────
app.use("/api", appStateRouter);
app.use("/api/po", poRouter);

// ── Error handler ───────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack || err.message || err);
  res.status(err.status || 500).json({ success: false, error: err.message || "Server error" });
});

app.listen(PORT, () => {
  console.log(`PO App API running on port ${PORT}`);
});
