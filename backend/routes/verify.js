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

  const model  = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
  const result = await model.generateContent(prompt);

  return result.response.text() || "Report generation failed.";
}

// ── Helper: Gemini Multimodal Vision for deep AI image & tampering detection ──
async function analyzeImageWithGeminiVision(buffer, mimetype) {
  const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
  const imagePart = {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType: mimetype || "image/jpeg",
    },
  };

  const prompt = `You are an elite digital forensic investigator analyzing this image for AI generation (Midjourney, DALL-E, Stable Diffusion, Flux, etc.) or document tampering.

Examine this image meticulously for:
1. AI Generation signatures:
   - Plastic / overly smooth skin textures, airbrushed appearance, lack of natural dermal pores
   - Anatomy errors: unnatural finger/hand geometry, asymmetrical pupils, impossible teeth or ear details
   - Surreal or melting background elements, illogical lighting, impossible specular highlights
   - Lack of authentic camera optical lens distortion and ISO sensor noise grain
   - Nonsensical or distorted AI-generated text/lettering.
2. Document Tampering & Forgery:
   - Mismatched typography, misaligned text, irregular spacing
   - Copy-paste digital seams, cloned patches, whiteout artifacts.
3. Authentic Camera / Document indicators:
   - Coherent optical depth of field, natural physics and shadows
   - Consistent sensor noise across the entire image
   - Clean, standardized document layout.

Respond ONLY with a JSON object in this exact schema (no markdown, just raw JSON):
{
  "verdict": "TAMPERED" | "CLEAN" | "SUSPICIOUS",
  "label": "Short label (e.g. 'AI-Generated Image Detected' or 'Document Appears Genuine')",
  "confidenceScore": integer 60-99,
  "riskLevel": "HIGH" | "MEDIUM" | "LOW",
  "reason": "2-3 concise, professional sentences explaining your specific visual forensic findings."
}`;

  const res = await model.generateContent([prompt, imagePart]);
  const text = res.response.text().trim();
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned);
}

// ── Helper: Forward to Python ML service with fallback ────────────────────────
async function callMLService(fileType, fileBuffer, originalname, mimetype) {
  const RENDER_ML = "https://trustlens-ml-cm23.onrender.com";
  const primaryBase  = ML_URL;
  const fallbackBase = ML_URL.includes("localhost") ? RENDER_ML : "http://localhost:5001";
  const primaryEndpoint  = fileType === "video" ? `${primaryBase}/analyze/video`  : `${primaryBase}/analyze/document`;
  const fallbackEndpoint = fileType === "video" ? `${fallbackBase}/analyze/video` : `${fallbackBase}/analyze/document`;

  function buildForm() {
    const f = new FormData();
    f.append("file", fileBuffer, { filename: originalname, contentType: mimetype });
    return f;
  }

  const primaryForm = buildForm();
  try {
    const primaryTimeout = primaryBase.includes("localhost") ? 3_000 : 120_000;
    const res = await axios.post(primaryEndpoint, primaryForm, {
      headers:          { ...primaryForm.getHeaders() },
      maxContentLength: Infinity,
      maxBodyLength:    Infinity,
      timeout:          primaryTimeout,
    });
    return res.data;
  } catch (primaryErr) {
    console.log(`[Verify] Primary ML (${primaryBase}) failed: ${primaryErr.message}. Falling back to ${fallbackBase}...`);
    const fallbackForm = buildForm();
    const res = await axios.post(fallbackEndpoint, fallbackForm, {
      headers:          { ...fallbackForm.getHeaders() },
      maxContentLength: Infinity,
      maxBodyLength:    Infinity,
      timeout:          120_000,
    });
    return res.data;
  }
}

// ── POST /api/verify — main verification endpoint ─────────────────────────────
router.post("/", protect, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const fileType = getFileType(req.file.originalname);

  try {
    let verdict = "CLEAN";
    let label = "Document Appears Genuine";
    let confidenceScore = 80;
    let riskLevel = "LOW";
    let claudeReport = "";
    let mlRawResponse = {};

    if (fileType === "video") {
      // ── Video: Use Python ML Service ───────────────────────────────────────
      const mlResult = await callMLService(fileType, req.file.buffer, req.file.originalname, req.file.mimetype);
      mlRawResponse = mlResult;
      verdict = mlResult.verdict;
      label   = mlResult.label;
      confidenceScore = mlResult.confidence_score;
      riskLevel = getRiskLevel(mlResult.verdict, mlResult.confidence_score);

      try {
        claudeReport = await generateClaudeReport(fileType, mlResult);
      } catch (claudeErr) {
        console.error("[Verify] Report generation error:", claudeErr.message);
        claudeReport = `${mlResult.label}. Confidence: ${mlResult.confidence_score}%.`;
      }

    } else {
      // ── Document / Image: Hybrid Gemini Vision + ML Service ─────────────────
      // Run both in parallel for speed and maximum forensic accuracy
      const [visionSettled, mlSettled] = await Promise.allSettled([
        analyzeImageWithGeminiVision(req.file.buffer, req.file.mimetype),
        callMLService(fileType, req.file.buffer, req.file.originalname, req.file.mimetype),
      ]);

      const visionData = visionSettled.status === "fulfilled" ? visionSettled.value : null;
      const mlData     = mlSettled.status === "fulfilled"     ? mlSettled.value     : null;

      if (visionSettled.status === "rejected") {
        console.warn("[Verify] Vision analysis failed:", visionSettled.reason?.message);
      }
      if (mlSettled.status === "rejected") {
        console.warn("[Verify] ML service failed:", mlSettled.reason?.message);
      }

      mlRawResponse = {
        vision: visionData,
        ml:     mlData,
      };

      if (visionData) {
        // Gemini Vision takes lead for visual AI artifacts & tampering
        verdict         = visionData.verdict;
        label           = visionData.label;
        confidenceScore = visionData.confidenceScore || 85;
        riskLevel       = visionData.riskLevel || getRiskLevel(verdict, confidenceScore);
        claudeReport    = visionData.reason;

        // If ML service also flagged tampering, confirm high severity
        if (mlData && (mlData.verdict === "TAMPERED" || mlData.verdict === "SUSPICIOUS")) {
          if (verdict === "CLEAN") {
            verdict   = "SUSPICIOUS";
            riskLevel = "MEDIUM";
            label     = "Compression Anomalies Detected";
            claudeReport += ` ELA forensics additionally noted compression irregularities (score: ${mlData.ela_score}).`;
          }
        }
      } else if (mlData) {
        // Fallback to ML service if Vision was unavailable
        verdict         = mlData.verdict;
        label           = mlData.label;
        confidenceScore = mlData.confidence_score;
        riskLevel       = getRiskLevel(mlData.verdict, mlData.confidence_score);

        try {
          claudeReport = await generateClaudeReport(fileType, mlData);
        } catch (e) {
          claudeReport = `${mlData.label}. Confidence: ${mlData.confidence_score}%.`;
        }
      } else {
        throw new Error("Both Vision and ML analysis services were unavailable.");
      }
    }

    // Save to MongoDB
    const record = await Verification.create({
      userId:          req.user._id,
      type:            fileType,
      filename:        req.file.originalname,
      verdict,
      label,
      confidenceScore,
      mlRawResponse,
      claudeReport,
      riskLevel,
    });

    // Return combined result
    res.status(201).json({
      id:              record._id,
      type:            fileType,
      filename:        req.file.originalname,
      verdict:         record.verdict,
      label:           record.label,
      confidenceScore: record.confidenceScore,
      riskLevel:       record.riskLevel,
      claudeReport:    record.claudeReport,
      createdAt:       record.createdAt,
    });

  } catch (err) {
    console.error("[Verify] Verification error:", err.message);
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
