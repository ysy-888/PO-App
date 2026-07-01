import "dotenv/config";
import express from "express";
import cors from "cors";
import appStateRouter from "./routes/appState.js";
import poRouter from "./routes/po.js";
import customersRouter from "./routes/customers.js";
import stylesRouter from "./routes/styles.js";
import settingsRouter from "./routes/settings.js";
import packingListsRouter from "./routes/packingLists.js";
import shipmentsRouter from "./routes/shipments.js";
import requestsRouter from "./routes/requests.js";
import chargebacksRouter from "./routes/chargebacks.js";
import pendingPackingListsRouter from "./routes/pendingPackingLists.js";
import salesOrdersRouter from "./routes/salesOrders.js";
import { getEmailServiceStatus } from "./email.js";

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

app.use(express.json({ limit: "10mb" }));

// ── Health check ────────────────────────────────────────────
app.get("/health", (_req, res) => {
  const email = getEmailServiceStatus();
  res.json({
    ok: true,
    email: {
      configured: email.configured,
      usingShippingRelay: email.usingShippingRelay,
      relayReady: email.relayReady,
      tokenConfigured: email.tokenConfigured,
      deploymentIdSuffix: email.deploymentId ? email.deploymentId.slice(-8) : "",
    },
  });
});

// ── Routes ──────────────────────────────────────────────────
app.use("/api", appStateRouter);
app.use("/api/po", poRouter);
app.use("/api/customers", customersRouter);
app.use("/api/styles", stylesRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/packing-list", packingListsRouter);
app.use("/api/shipments", shipmentsRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/chargebacks", chargebacksRouter);
app.use("/api/pending-packing-lists", pendingPackingListsRouter);
app.use("/api/sales-orders", salesOrdersRouter);

// ── Error handler ───────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack || err.message || err);
  res.status(err.status || 500).json({ success: false, error: err.message || "Server error" });
});

app.listen(PORT, () => {
  console.log(`PO App API running on port ${PORT}`);
});
