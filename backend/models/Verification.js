const mongoose = require("mongoose");

const VerificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["video", "document"],
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    // Raw ML output
    verdict: {
      type: String,
      enum: ["REAL", "FAKE", "CLEAN", "SUSPICIOUS", "TAMPERED"],
      required: true,
    },
    // "Deepfake Detected", "Appears Authentic", etc.
    label: {
      type: String,
      required: true,
    },
    confidenceScore: {
      type: Number,   // 0–100
      required: true,
    },
    // Full ML payload (for debugging / audit trail)
    mlRawResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Claude-generated plain-language fraud report
    claudeReport: {
      type: String,
      default: "",
    },
    // UI-friendly risk level
    riskLevel: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Verification", VerificationSchema);
