/**
 * TrustLens — Express Entry Point
 */
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const authRoutes   = require("./routes/auth");
const verifyRoutes = require("./routes/verify");

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:5173",
    "http://localhost:3000",
  ],
  credentials: true,
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",   authRoutes);
app.use("/api/verify", verifyRoutes);

// Health check
app.get("/health", (_, res) => res.json({ status: "ok", service: "TrustLens Backend v1.0" }));

// 404 handler
app.use((_, res) => res.status(404).json({ error: "Route not found" }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("[TrustLens]", err.stack || err.message);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

// ── Database ──────────────────────────────────────────────────────────────────
// Start the server immediately so ML/verify routes work even without MongoDB.
// Auth routes will return 503 gracefully if Mongo is unavailable.
app.listen(PORT, () => console.log(`[TrustLens] Backend running on port ${PORT}`));

mongoose.set('bufferCommands', false);

mongoose
  .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log("[TrustLens] MongoDB connected");
  })
  .catch((err) => {
    console.error(
      "[TrustLens] MongoDB connection error (auth routes will be unavailable):",
      err.message,
    );
    console.error(
      "[TrustLens] FIX: Go to MongoDB Atlas → Network Access → Add your current IP address.",
    );
  });
