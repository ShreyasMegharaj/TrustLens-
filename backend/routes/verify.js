const express      = require("express");
const path         = require("path");
const axios        = require("axios");
const FormData     = require("form-data");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const { protect }         = require("../middleware/auth");
const { upload, ALLOWED_VIDEO } = require("../middleware/upload");
const Verification        = require("../models/Verification");

const router  = express.Router();
const genAI   = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const ML_URL  = process.env.ML_SERVICE_URL || "http://localhost:5001";

// ── Helper: determine file type ───────────────────────────────────────────────
function getFileType(originalname) {
  const ext = path.extname(originalname).toLowerCase();
  return ALLOWED_VIDEO.includes(ext) ? "video" : "document";
}

// ── Helper: compute risk level ────────────────────────────────────────────────
function getRiskLevel(verdict, confidence) {
  if (verdict === "REAL" || verdict === "CLEAN") return "LOW";
  if (verdict === "SUSPICIOUS") return "MEDIUM";
  if (confidence >= 70) return "HIGH";
  return "MEDIUM";
}

// ── Helper: call Gemini for plain-language fraud report ──────────────────────
async function generateClaudeReport(fileType, mlResult) {
  const prompt = fileType === "video"
    ? `You are a forensic analyst reviewing a deepfake detection result. Summarise the findings in 2-3 clear sentences for a non-technical user.

ML Result:
- Verdict: ${mlResult.verdict}
- Label: ${mlResult.label}
- Fake Probability: ${(mlResult.fake_probability * 100).toFixed(1)}%
- Confidence: ${mlResult.confidence_score}%
- Frames analysed: ${mlResult.frames_analyzed}

Write a concise, professional report. Start with the verdict, then explain what it means, then advise on next steps if the content is suspected fake.`
    : `You are a forensic analyst reviewing a document tampering detection result. Summarise the findings in 2-3 clear sentences for a non-technical user.

ML Result:
- Verdict: ${mlResult.verdict}
- Label: ${mlResult.label}
- ELA Score: ${mlResult.ela_score}
- Confidence: ${mlResult.confidence_score}%
- Error Details: Mean=${mlResult.ela_details?.mean_error}, Max=${mlResult.ela_details?.max_error}

Write a concise, professional report. Start with the verdict, explain what ELA analysis found, then advise on next steps.`;

  const model  = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(prompt);

  return result.response.text() || "Report generation failed.";
}

// ── POST /api/verify — main verification endpoint ─────────────────────────────
router.post("/", protect, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const fileType = getFileType(req.file.originalname);
  const mlEndpoint = fileType === "video"
    ? `${ML_URL}/analyze/video`
    : `${ML_URL}/analyze/document`;

  try {
    // 1. Forward file to ML service
    const form = new FormData();
    form.append("file", req.file.buffer, {
      filename:    req.file.originalname,
      contentType: req.file.mimetype,
    });

    const mlResponse = await axios.post(mlEndpoint, form, {
      headers:        { ...form.getHeaders() },
      maxContentLength: Infinity,
      maxBodyLength:    Infinity,
      timeout:          120_000, // 2 min timeout for large videos
    });

    const mlResult = mlResponse.data;

    // 2. Generate Claude plain-language report
    let claudeReport = "";
    try {
      claudeReport = await generateClaudeReport(fileType, mlResult);
    } catch (claudeErr) {
      console.error("[Verify] Claude API error:", claudeErr.message);
      claudeReport = `${mlResult.label}. Confidence: ${mlResult.confidence_score}%.`;
    }

    // 3. Compute risk level
    const riskLevel = getRiskLevel(mlResult.verdict, mlResult.confidence_score);

    // 4. Save to MongoDB
    const record = await Verification.create({
      userId:         req.user._id,
      type:           fileType,
      filename:       req.file.originalname,
      verdict:        mlResult.verdict,
      label:          mlResult.label,
      confidenceScore: mlResult.confidence_score,
      mlRawResponse:  mlResult,
      claudeReport,
      riskLevel,
    });

    // 5. Return combined result
    res.status(201).json({
      id:             record._id,
      type:           fileType,
      filename:       req.file.originalname,
      verdict:        mlResult.verdict,
      label:          mlResult.label,
      confidenceScore: mlResult.confidence_score,
      riskLevel,
      claudeReport,
      createdAt:      record.createdAt,
    });

  } catch (err) {
    if (err.response) {
      // ML service returned an HTTP error response
      console.error("[Verify] ML service HTTP error:", err.response.status, err.response.data);
      return res.status(502).json({ error: "ML service error: " + (err.response.data?.error || "Unknown") });
    }
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      console.error("[Verify] ML service is not running at", ML_URL);
      return res.status(503).json({ error: "ML service is offline. Please start the Python ML service on port 5001." });
    }
    console.error("[Verify] Unexpected error:", err.code, err.message, err.stack);
    res.status(500).json({ error: "Verification failed: " + (err.message || "Unknown error") });
  }
});

// ── GET /api/verify/history — user's past verifications ──────────────────────
router.get("/history", protect, async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip  = (page - 1) * limit;

    const [records, total] = await Promise.all([
      Verification.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-mlRawResponse"), // exclude large raw payload from list view
      Verification.countDocuments({ userId: req.user._id }),
    ]);

    res.json({
      records,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[Verify/history]", err.message);
    res.status(500).json({ error: "Failed to fetch history." });
  }
});

// ── GET /api/verify/:id — single verification detail ─────────────────────────
router.get("/:id", protect, async (req, res) => {
  try {
    const record = await Verification.findOne({
      _id:    req.params.id,
      userId: req.user._id,
    });

    if (!record) {
      return res.status(404).json({ error: "Verification not found." });
    }

    res.json(record);
  } catch (err) {
    console.error("[Verify/:id]", err.message);
    res.status(500).json({ error: "Failed to fetch record." });
  }
});

module.exports = router;
