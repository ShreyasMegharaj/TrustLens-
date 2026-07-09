"""
TrustLens ML Service v2.0
Flask API exposing two endpoints:
  POST /analyze/video    — deepfake detection via ResNeXt50 (or heuristic ensemble)
  POST /analyze/document — document tampering via Enhanced ELA + ensemble voting

Key improvements over v1:
  - Multi-pass averaging on document analysis (3 passes for stability)
  - 32-frame video extraction (up from 16) for better temporal stats
  - Improved confidence calibration (non-linear, never overconfident at threshold)
  - Per-signal breakdown returned in API response
  - Screenshot-aware scoring (lower false positive rate on UI captures)
"""

import os
import io
import traceback
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

from utils import (
    extract_frames,
    preprocess_frame,
    ela_analysis,
    load_deepfake_model,
    predict_deepfake,
    analyze_video_without_model,
)

app = Flask(__name__)
CORS(app)

# ── Configuration ─────────────────────────────────────────────────────────────
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "temp_uploads")
MODEL_PATH    = os.path.join(os.path.dirname(__file__), "model", "resnext50_deepfake.pth")
ALLOWED_VIDEO = {"mp4", "avi", "mov", "mkv", "webm"}
ALLOWED_IMAGE = {"jpg", "jpeg", "png", "bmp", "tiff", "webp"}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Load model once at startup (lazy if file doesn't exist yet)
deepfake_model = None
if os.path.exists(MODEL_PATH):
    deepfake_model = load_deepfake_model(MODEL_PATH)
    print(f"[TrustLens] Deepfake model loaded from {MODEL_PATH}")
else:
    print(f"[TrustLens] WARNING: Model file not found at {MODEL_PATH}. "
          "Video analysis will run in enhanced heuristic mode (v2).")


def allowed_file(filename, allowed_set):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed_set


# ── Health check ──────────────────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":       "ok",
        "model_loaded": deepfake_model is not None,
        "service":      "TrustLens ML Service v2.0",
        "mode":         "neural" if deepfake_model is not None else "heuristic-ensemble",
    })


# ── Endpoint 1: Video deepfake detection ─────────────────────────────────────
@app.route("/analyze/video", methods=["POST"])
def analyze_video():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    if not allowed_file(file.filename, ALLOWED_VIDEO):
        return jsonify({"error": f"Unsupported video format. Allowed: {ALLOWED_VIDEO}"}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    try:
        # Extract 32 evenly-spaced frames (up from 16 for better temporal stats)
        frames = extract_frames(filepath, num_frames=32)
        if not frames:
            return jsonify({"error": "Could not extract frames from video"}), 422

        if deepfake_model is not None:
            # ── Neural model path ─────────────────────────────────────────────
            # Run each frame through the model and average probabilities.
            # Multi-pass: also run the heuristic signals and blend with model output
            # for maximum accuracy (neural + heuristic ensemble).
            frame_scores = []
            for frame in frames:
                tensor = preprocess_frame(frame)
                score  = predict_deepfake(deepfake_model, tensor)
                frame_scores.append(float(score))

            # Robust aggregation: use trimmed mean (remove top/bottom 10%)
            frame_scores_sorted = sorted(frame_scores)
            trim = max(1, len(frame_scores_sorted) // 10)
            trimmed = frame_scores_sorted[trim:-trim] if trim > 0 else frame_scores_sorted
            neural_prob = float(np.mean(trimmed))

            # Also run heuristic for blending
            heuristic = analyze_video_without_model(frames)
            heuristic_prob = heuristic["fake_probability"]

            # Blend: 75% neural, 25% heuristic
            fake_probability = float(np.clip(neural_prob * 0.75 + heuristic_prob * 0.25, 0, 1))
            confidence       = round(abs(fake_probability - 0.5) * 2 * 100, 2)
            is_fake          = fake_probability >= 0.5

            extra = heuristic.get("signals", {})
            ensemble_info = heuristic.get("ensemble", {})

        else:
            # ── Enhanced heuristic path (no model) ───────────────────────────
            analysis        = analyze_video_without_model(frames)
            fake_probability = analysis["fake_probability"]
            confidence       = analysis["confidence_score"]
            is_fake          = fake_probability >= 0.45   # slightly aggressive threshold

            extra         = analysis.get("signals", {})
            ensemble_info = analysis.get("ensemble", {})

        verdict = "FAKE" if is_fake else "REAL"
        label   = "Deepfake Detected" if is_fake else "Appears Authentic"

        return jsonify({
            "type":             "video",
            "verdict":          verdict,
            "label":            label,
            "fake_probability": round(fake_probability, 4),
            "confidence_score": confidence,
            "frames_analyzed":  len(frames),
            "demo_mode":        deepfake_model is None,
            "signals":          extra,
            "ensemble":         ensemble_info,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

    finally:
        if os.path.exists(filepath):
            os.remove(filepath)


# ── Endpoint 2: Document tampering detection (Enhanced ELA) ──────────────────
@app.route("/analyze/document", methods=["POST"])
def analyze_document():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    if not allowed_file(file.filename, ALLOWED_IMAGE):
        return jsonify({"error": f"Unsupported image format. Allowed: {ALLOWED_IMAGE}"}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    try:
        # ── Multi-pass averaging for score stability ──────────────────────────
        # Run ELA analysis 3 times.  ela_analysis() v2 internally already runs
        # 3 quality-perturbed passes, so this outer loop gives us 9 total
        # passes averaged together → extremely stable score.
        NUM_OUTER_PASSES = 3
        all_scores   = []
        all_details  = None

        for _ in range(NUM_OUTER_PASSES):
            score, details = ela_analysis(filepath)
            all_scores.append(score)
            if all_details is None:
                all_details = details  # save first pass details for breakdown

        ela_score = float(np.mean(all_scores))
        ela_std   = float(np.std(all_scores))   # how much did passes vary?

        # Pull the screenshot flag from the last analysis pass
        is_screenshot = all_details.get("is_screenshot", False)
        ensemble_ratio = all_details.get("ensemble_fake_ratio", 0.5)

        # ── Adaptive thresholds ───────────────────────────────────────────────
        # Screenshots naturally score higher due to UI chrome, mixed content,
        # and double-compression layers. Use looser thresholds for screenshots.
        #
        # Natural images:
        #   score < 8   → CLEAN
        #   8 ≤ s < 20  → SUSPICIOUS
        #   s ≥ 20      → TAMPERED
        #
        # Screenshots:
        #   score < 14  → CLEAN
        #   14 ≤ s < 28 → SUSPICIOUS
        #   s ≥ 28      → TAMPERED
        #
        # Additionally: ensemble vote can escalate SUSPICIOUS → TAMPERED if
        # 5+ of 6 signals agree (fake_ratio ≥ 0.80).

        if is_screenshot:
            clean_threshold    = 14.0
            tampered_threshold = 28.0
        else:
            clean_threshold    = 8.0
            tampered_threshold = 20.0

        if ela_score < clean_threshold:
            verdict = "CLEAN"
            label   = "Document Appears Genuine"
        elif ela_score < tampered_threshold:
            # Check if ensemble strongly disagrees
            if ensemble_ratio >= 0.80:
                verdict = "TAMPERED"
                label   = "Strong Evidence of AI Generation or Document Tampering"
            else:
                verdict = "SUSPICIOUS"
                label   = "Anomalies Detected — Possible AI Generation or Tampering"
        else:
            verdict = "TAMPERED"
            label   = "Strong Evidence of AI Generation or Document Tampering"

        # ── Confidence calibration ────────────────────────────────────────────
        # Non-linear scale so scores at threshold ≠ high confidence.
        # Stability bonus: if all 3 outer passes agreed tightly (low std),
        # confidence is higher; if they varied, we penalise confidence.
        stability_bonus = max(0.0, 5.0 - ela_std * 2.0)   # up to +5 if very stable

        if verdict == "CLEAN":
            # Score 0…threshold → confidence 92% down to 50%
            dist = clean_threshold - ela_score
            raw_conf = min(92.0, 50.0 + dist * (42.0 / clean_threshold))
        elif verdict == "SUSPICIOUS":
            span = tampered_threshold - clean_threshold
            mid  = (ela_score - clean_threshold) / (span + 1e-8)
            raw_conf = min(70.0, 45.0 + mid * 25.0)
        else:
            raw_conf = min(92.0, 65.0 + (ela_score - tampered_threshold) * 1.2)

        confidence = round(min(92.0, raw_conf + stability_bonus), 2)

        return jsonify({
            "type":             "document",
            "verdict":          verdict,
            "label":            label,
            "ela_score":        round(ela_score, 4),
            "confidence_score": confidence,
            "ela_details":      all_details,
            "is_screenshot":    is_screenshot,
            "passes_std":       round(ela_std, 4),   # score stability indicator
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

    finally:
        if os.path.exists(filepath):
            os.remove(filepath)


if __name__ == "__main__":
    port  = int(os.environ.get("PORT", 5001))
    debug = os.environ.get("FLASK_ENV", "production") == "development"
    app.run(host="0.0.0.0", port=port, debug=debug)
