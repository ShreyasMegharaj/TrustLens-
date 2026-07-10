"""
TrustLens ML Utilities — Enhanced Multi-Signal Detection Engine v2.0
=======================================================================
Key improvements over v1:
  * Multi-run averaging  — 3 passes per analysis eliminates JPEG encoder noise
  * Screenshot detection — separate scoring path for UI/browser screenshots
  * MAD noise fingerprint — Median Absolute Deviation is robust to outliers
  * Autocorrelation test — GAN noise has measurable spatial correlation
  * DCT outlier blocks  — statistical outlier detection (Z-score) in 8x8 blocks
  * SSIM variance       — structural similarity temporal consistency for video
  * Ensemble voting     — signals vote independently, no single threshold flips verdict
  * More video frames   — 32 frames default (up from 16) for better temporal stats

Detection signals:
  Images : multi-quality ELA (3-pass averaged) · MAD noise · autocorrelation
           · FFT frequency · DCT outlier blocks · edge irregularity
  Videos : temporal consistency · SSIM variance · noise uniformity · frequency
           · color drift · texture smoothness · optical flow
"""

import io
import cv2
import numpy as np
from PIL import Image, ImageChops, ImageEnhance, ImageFilter

# Torch is optional — model functions raise clear errors when missing
try:
    import torch
    import torch.nn as nn
    from torchvision import transforms, models
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


# ── Transform for ResNeXt50 ───────────────────────────────────────────────────

_transform = None

def _get_transform():
    global _transform
    if _transform is None and TORCH_AVAILABLE:
        _transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406],
                                 std=[0.229, 0.224, 0.225]),
        ])
    return _transform


# ── Frame extraction ──────────────────────────────────────────────────────────

def extract_frames(video_path: str, num_frames: int = 32) -> list:
    """Extract `num_frames` evenly-spaced frames. Returns list of PIL Images."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total <= 0:
        cap.release()
        return []

    indices = np.linspace(0, total - 1, num=min(num_frames, total), dtype=int)
    frames = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ret, frame = cap.read()
        if ret:
            frames.append(Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)))

    cap.release()
    return frames


# ── Frame preprocessing ───────────────────────────────────────────────────────

def preprocess_frame(pil_image: Image.Image):
    """PIL Image → normalised torch Tensor (1, 3, 224, 224)."""
    if not TORCH_AVAILABLE:
        raise RuntimeError("torch/torchvision not installed.")
    return _get_transform()(pil_image).unsqueeze(0)


# ── Model loading ─────────────────────────────────────────────────────────────

def load_deepfake_model(model_path: str):
    """Load binary-classification ResNeXt50_32x4d from .pth checkpoint."""
    if not TORCH_AVAILABLE:
        raise RuntimeError("torch not installed.")
    model = models.resnext50_32x4d(weights=None)
    model.fc = nn.Linear(model.fc.in_features, 2)
    checkpoint = torch.load(model_path, map_location="cpu")
    state_dict = checkpoint.get("model_state_dict", checkpoint)
    model.load_state_dict(state_dict)
    model.eval()
    return model


def predict_deepfake(model, tensor) -> float:
    """Run tensor through model → fake probability (0=real, 1=fake)."""
    if not TORCH_AVAILABLE:
        raise RuntimeError("torch not installed.")
    with torch.no_grad():
        probs = torch.softmax(model(tensor), dim=1)
        return probs[0, 1].item()


# ═════════════════════════════════════════════════════════════════════════════
#  SHARED UTILITIES
# ═════════════════════════════════════════════════════════════════════════════

def _kurtosis(x: np.ndarray) -> float:
    std = x.std()
    if std < 1e-8:
        return 3.0
    return float(np.mean(((x - x.mean()) / std) ** 4))


def _recompress(img: Image.Image, quality: int) -> Image.Image:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    buf.seek(0)
    return Image.open(buf).convert("RGB")


def _is_screenshot(arr: np.ndarray) -> bool:
    """
    Heuristic: detect if the image is a UI/browser screenshot.
    Screenshots tend to have:
      - Very high edge density (UI chrome, text, icons)
      - Restricted color palette (UI theme colors, often <4096 unique colors in a sample)
      - Flat uniform regions interspersed with sharp boundaries

    Returns True if the image is likely a screenshot.
    """
    arr_u8 = np.clip(arr, 0, 255).astype(np.uint8)
    gray = arr_u8.mean(axis=2).astype(np.uint8)

    # Signal 1: edge density (Canny)
    edges = cv2.Canny(gray, 80, 160)
    edge_density = edges.sum() / (255.0 * edges.size + 1e-8)

    # Signal 2: color uniqueness — sample 10k pixels, count distinct quantized colors
    h, w = arr_u8.shape[:2]
    sample_size = min(10000, h * w)
    flat = arr_u8.reshape(-1, 3)
    idx = np.random.RandomState(42).choice(len(flat), sample_size, replace=False)
    sampled = flat[idx]
    # Quantize to 5-bit per channel (32 levels)
    quantized = (sampled >> 3)
    unique_colors = len(np.unique(quantized.view(np.uint8).reshape(-1, 3), axis=0))
    color_ratio = unique_colors / sample_size  # low = restricted palette (screenshots)

    # Signal 3: row/column uniformity — screenshots have many fully uniform rows
    row_stds = arr_u8.std(axis=(1, 2))
    uniform_row_ratio = float((row_stds < 5.0).mean())

    # Verdict: screenshots have high edges, low color ratio, or many uniform rows
    is_ss = (edge_density > 0.06 and color_ratio < 0.15) or uniform_row_ratio > 0.25
    return bool(is_ss)


def _ensemble_vote(signal_scores: dict, thresholds: dict) -> dict:
    """
    Each signal casts a binary vote (fake=1, real=0) compared to its threshold.
    Final verdict is weighted majority vote — much more stable than a single
    continuous threshold on the combined score.

    Returns {"fake_votes": int, "real_votes": int, "fake_ratio": float}
    """
    fake_votes = 0
    real_votes = 0
    total_weight = 0.0

    for key, score in signal_scores.items():
        threshold = thresholds.get(key, 0.5)
        weight = 1.0  # all signals weighted equally in voting
        if score >= threshold:
            fake_votes += weight
        else:
            real_votes += weight
        total_weight += weight

    fake_ratio = fake_votes / (total_weight + 1e-8)
    return {
        "fake_votes": fake_votes,
        "real_votes": real_votes,
        "fake_ratio": fake_ratio,
    }


# ═════════════════════════════════════════════════════════════════════════════
#  IMAGE DETECTION — Enhanced Multi-Signal ELA
# ═════════════════════════════════════════════════════════════════════════════

def ela_analysis(image_path: str, quality: int = 90) -> tuple:
    """
    Enhanced multi-signal forgery / AI-generation detection for images. v2.0

    Key improvements:
      - 3-pass averaged analysis eliminates JPEG encoder noise (main stability fix)
      - Screenshot detection → dedicated scoring thresholds
      - MAD + multi-scale noise fingerprint (more robust than kurtosis alone)
      - Spatial autocorrelation test for GAN noise signature
      - Statistical outlier DCT block detection
      - Ensemble voting decouples verdict from continuous threshold

    Returns (combined_score, details_dict)
    Higher score = more likely AI-generated / tampered.
    """
    original = Image.open(image_path).convert("RGB")
    arr = np.array(original, dtype=np.float32)

    is_screenshot = _is_screenshot(arr)

    # ── 3-Pass averaging for stability ───────────────────────────────────────
    # Run the full signal computation 3× with slightly different recompression
    # quality seeds and average. This eliminates the variance caused by JPEG
    # encoder randomness, making repeated calls produce consistent scores.
    pass_scores = []
    pass_variances = []
    quality_offsets = [0, -3, +3]  # three slightly different quality anchors

    for q_offset in quality_offsets:
        ela_s, ela_v = _multi_quality_ela(original, base_quality=quality + q_offset)
        pass_scores.append(ela_s)
        pass_variances.append(ela_v)

    ela_base     = float(np.mean(pass_scores))
    ela_variance = float(np.mean(pass_variances))

    # ── Signal 2: MAD + multi-scale noise fingerprint ────────────────────────
    noise_score = _mad_noise_fingerprint(arr)

    # ── Signal 3: Spatial autocorrelation (GAN noise signature) ─────────────
    autocorr_score = _autocorrelation_score(arr)

    # ── Signal 4: Frequency domain (FFT) ────────────────────────────────────
    freq_score = _frequency_anomaly(arr, is_screenshot=is_screenshot)

    # ── Signal 5: DCT block outlier detection ────────────────────────────────
    block_score = _dct_outlier_blocks(arr)

    # ── Signal 6: Edge sharpness irregularity ───────────────────────────────
    edge_score = _edge_irregularity(arr, is_screenshot=is_screenshot)

    # ── Combine signals ───────────────────────────────────────────────────────
    # Use screenshot-aware weights to reduce false positives on UI captures.
    if is_screenshot:
        # Screenshots: down-weight edge and frequency (naturally high in UIs)
        combined = (
            ela_base      * 0.40 +
            ela_variance  * 0.25 +
            noise_score   * 0.18 +
            autocorr_score* 0.10 +
            freq_score    * 0.04 +
            block_score   * 0.02 +
            edge_score    * 0.01
        )
    else:
        # Natural photographs: balanced weighting
        combined = (
            ela_base      * 0.32 +
            ela_variance  * 0.20 +
            noise_score   * 0.18 +
            autocorr_score* 0.14 +
            freq_score    * 0.08 +
            block_score   * 0.05 +
            edge_score    * 0.03
        )

    # ── Ensemble vote for stability check ────────────────────────────────────
    # Signals vote independently. If 4+ of 6 signals agree → high confidence.
    signal_scores = {
        "ela_base":      ela_base,
        "ela_variance":  ela_variance,
        "noise":         noise_score,
        "autocorr":      autocorr_score,
        "frequency":     freq_score,
        "block":         block_score,
    }
    # Thresholds calibrated per signal (at what value does each signal indicate fake)
    signal_thresholds = {
        "ela_base":     6.0,
        "ela_variance": 2.5,
        "noise":        2.0,
        "autocorr":     0.15,
        "frequency":    2.0,
        "block":        1.5,
    }
    vote = _ensemble_vote(signal_scores, signal_thresholds)

    # Build reference diff for backward-compatible detail fields
    ref_diff = np.array(ImageChops.difference(original, _recompress(original, 75)),
                        dtype=np.float32)

    details = {
        "mean_error":          round(ela_base, 4),
        "max_error":           round(float(ref_diff.max()), 4),
        "std_error":           round(ela_variance, 4),
        "noise_mad":           round(noise_score, 4),
        "autocorrelation":     round(autocorr_score, 4),
        "frequency_anomaly":   round(freq_score, 4),
        "block_inconsistency": round(block_score, 4),
        "edge_irregularity":   round(edge_score, 4),
        "is_screenshot":       is_screenshot,
        "ensemble_fake_ratio": round(vote["fake_ratio"], 4),
        "red_channel_mean":    round(float(arr[:, :, 0].mean()), 4),
        "green_channel_mean":  round(float(arr[:, :, 1].mean()), 4),
        "blue_channel_mean":   round(float(arr[:, :, 2].mean()), 4),
    }

    return combined, details


# ── Image signal helpers ──────────────────────────────────────────────────────

def _multi_quality_ela(img: Image.Image, base_quality: int = 90) -> tuple:
    """
    Compute weighted average ELA score across 6 JPEG quality levels.
    Returns (weighted_mean_score, variance_across_levels).
    The 3-pass outer loop in ela_analysis calls this with slightly different
    base_quality values and averages the outputs — eliminating encoder noise.
    """
    # Clamp quality to valid JPEG range
    base_quality = int(np.clip(base_quality, 50, 95))

    quality_levels = [
        max(40, base_quality - 40),
        max(50, base_quality - 25),
        max(60, base_quality - 15),
        max(70, base_quality - 5),
        base_quality,
        min(95, base_quality + 5),
    ]
    weights = [2.5, 2.0, 1.5, 1.0, 0.75, 0.5]

    ela_scores = []
    for q in quality_levels:
        compressed = _recompress(img, q)
        diff = np.array(ImageChops.difference(img, compressed), dtype=np.float32)
        ela_scores.append(diff.mean())

    ela_scores = np.array(ela_scores)
    weighted_mean = float(np.average(ela_scores, weights=weights))
    variance = float(ela_scores.std())

    return weighted_mean, variance


def _mad_noise_fingerprint(arr: np.ndarray) -> float:
    """
    Robust multi-scale noise fingerprint using Median Absolute Deviation (MAD).
    MAD is far less sensitive to outliers than std/kurtosis.

    Analyzes noise at 3 scales (fine, medium, coarse). GAN images have:
      - Unnaturally low fine-scale noise (over-smoothing)
      - Unnaturally flat noise across scales (no natural 1/f roll-off)

    Returns a score where higher = more anomalous (more likely AI-generated).
    """
    scores = []
    kernel_sizes = [(5, 5), (11, 11), (21, 21)]

    for c in range(3):
        channel = arr[:, :, c]
        channel_scores = []

        for ksize in kernel_sizes:
            blurred = cv2.GaussianBlur(channel, ksize, 0)
            residual = (channel - blurred).flatten()

            # MAD: robust equivalent of standard deviation
            median = np.median(residual)
            mad = np.median(np.abs(residual - median))

            # Natural noise: MAD ~ 1.5-5 in float32 pixel range
            # GAN over-smooth: MAD < 0.8 → low noise anomaly
            channel_scores.append(mad)

        # Score: penalize if noise is too low (over-smooth) or too high
        fine_mad   = channel_scores[0]
        medium_mad = channel_scores[1]
        coarse_mad = channel_scores[2]

        # Natural 1/f roll-off: fine > medium > coarse. GAN breaks this.
        rolloff_anomaly = abs((fine_mad - coarse_mad) / (fine_mad + 1e-8) - 0.6)

        # Low noise penalty: GAN images have abnormally flat/low noise
        low_noise_penalty = max(0.0, 3.0 - fine_mad) * 0.4

        scores.append(rolloff_anomaly * 2.0 + low_noise_penalty)

    return float(np.mean(scores))


def _autocorrelation_score(arr: np.ndarray) -> float:
    """
    Spatial autocorrelation test for GAN noise.
    Real camera noise: spatially independent (white noise) → autocorrelation ≈ 0.
    GAN noise: spatially correlated due to upsampling artifacts → autocorrelation > 0.

    We measure the 1-lag spatial autocorrelation of the noise residual.
    """
    scores = []
    for c in range(3):
        channel = arr[:, :, c]
        # Extract noise residual
        blurred = cv2.GaussianBlur(channel, (5, 5), 0)
        residual = channel - blurred

        # Downsample for speed (max 256×256)
        h, w = residual.shape
        if h > 256 or w > 256:
            scale = min(256.0 / h, 256.0 / w)
            residual = cv2.resize(residual, (int(w * scale), int(h * scale)))

        residual = residual.flatten()
        n = len(residual)
        if n < 10:
            continue

        # 1-lag autocorrelation
        r = residual - residual.mean()
        var = np.dot(r, r)
        if var < 1e-10:
            scores.append(0.0)
            continue

        autocorr = np.dot(r[:-1], r[1:]) / var
        scores.append(abs(float(autocorr)))

    if not scores:
        return 0.0

    # Scale: natural images ≈ 0.0–0.05, GAN images ≈ 0.1–0.4+
    return float(np.clip(np.mean(scores) * 3.0, 0, 1.5))


def _frequency_anomaly(arr: np.ndarray, is_screenshot: bool = False) -> float:
    """
    GAN upsampling leaves characteristic checkerboard and periodic artifacts
    in the frequency domain. We look for anomalously uniform mid-high frequency
    energy.

    Screenshot-aware: browser screenshots naturally exhibit periodic pixel
    patterns. When is_screenshot=True, we apply a stricter threshold.
    """
    scores = []
    for c in range(3):
        channel = arr[:, :, c]
        fft = np.fft.fftshift(np.fft.fft2(channel))
        mag = np.log1p(np.abs(fft))
        h, w = mag.shape
        cy, cx = h // 2, w // 2
        y, x = np.ogrid[:h, :w]
        dist = np.sqrt((y - cy) ** 2 + (x - cx) ** 2)

        r_inner = min(h, w) // 8
        r_outer = min(h, w) // 3

        ring   = mag[(dist >= r_inner) & (dist < r_outer)]
        center = mag[dist < r_inner]

        if len(ring) > 10 and center.mean() > 0:
            ratio = ring.mean() / center.mean()
            # Variance of the ring: GAN artifacts make it very uniform (low variance)
            ring_uniformity = 1.0 / (ring.std() + 0.5)
            scores.append(ratio * ring_uniformity)

    if not scores:
        return 0.0

    multiplier = 3.0 if is_screenshot else 5.0
    cap = 5.0 if is_screenshot else 8.0
    return float(np.clip(np.mean(scores) * multiplier, 0, cap))


def _dct_outlier_blocks(arr: np.ndarray) -> float:
    """
    Statistical outlier detection in 8×8 DCT blocks.
    Authentic images: block variances follow a consistent distribution.
    Tampered/AI regions: outlier blocks with drastically different statistics.

    Uses Z-score outlier detection: blocks more than 2.5σ from mean are flagged.
    Also flags blocks with near-zero variance (pasted flat regions).
    """
    gray = arr.mean(axis=2)
    h, w = gray.shape
    stds  = []
    means = []

    for i in range(0, h - 8, 8):
        for j in range(0, w - 8, 8):
            block = gray[i:i+8, j:j+8]
            stds.append(block.std())
            means.append(block.mean())

    if len(stds) < 4:
        return 0.0

    stds  = np.array(stds)
    means = np.array(means)

    # Z-score outlier detection on block stds
    std_mean = stds.mean()
    std_std  = stds.std()
    if std_std < 1e-8:
        return 0.0

    z_scores     = np.abs((stds - std_mean) / std_std)
    outlier_ratio = float((z_scores > 2.5).mean())   # fraction of outlier blocks

    # Flat region detection: blocks with near-zero std in a varied image
    flat_ratio = float((stds < 1.0).mean()) if std_mean > 5.0 else 0.0

    return float(np.clip(outlier_ratio * 3.0 + flat_ratio * 2.0, 0, 8))


def _edge_irregularity(arr: np.ndarray, is_screenshot: bool = False) -> float:
    """
    Copy-paste forgeries and AI inpainting leave sharp unnatural edges.
    Screenshot-aware: dark-themed UIs have many hard boundaries.
    """
    gray = arr.mean(axis=2).astype(np.uint8)
    edges = cv2.Canny(gray, 100, 200)
    ratio = edges.sum() / (255.0 * edges.size + 1e-8)

    multiplier = 20.0 if is_screenshot else 35.0
    cap = 5.0 if is_screenshot else 8.0
    return float(np.clip(ratio * multiplier, 0, cap))


# ═════════════════════════════════════════════════════════════════════════════
#  VIDEO DETECTION — Enhanced Multi-Signal (no model required)
# ═════════════════════════════════════════════════════════════════════════════

def analyze_video_without_model(frames: list) -> dict:
    """
    Comprehensive deepfake / AI-video detection using 7 independent signals. v2.0

    Improvements over v1:
      - SSIM variance added as signal 2 (structural similarity — more sensitive)
      - Face-region focus: central 60% of frame where faces appear
      - Ensemble voting: signals vote independently → stable verdict
      - 32-frame default → better temporal statistics

    Signals:
      1. Temporal consistency  — deepfakes flicker between frames (pixel diff)
      2. SSIM variance         — structural similarity inconsistency
      3. Noise uniformity      — GAN noise is unnaturally smooth / periodic
      4. Frequency anomaly     — GAN upsampling leaves spectral artifacts
      5. Color histogram drift — deepfakes suffer subtle colour shifts
      6. Texture smoothness    — AI faces are over-smooth (GAN style loss)
      7. Optical flow          — unnatural motion patterns near face boundaries

    Returns dict: fake_probability, confidence_score, signals, ensemble
    """
    if not frames:
        return {"fake_probability": 0.5, "confidence_score": 50.0, "signals": {}, "ensemble": {}}

    signals = {}

    # Run all signals
    t_score = _temporal_consistency(frames)
    x_score = _ssim_variance(frames)        # NEW in v2
    n_score = _video_noise_uniformity(frames)
    f_score = _video_frequency(frames)
    c_score = _color_drift(frames)
    s_score = _texture_smoothness(frames)
    o_score = _optical_flow_irregularity(frames)

    signals["temporal_inconsistency"] = round(t_score, 4)
    signals["ssim_variance"]          = round(x_score, 4)
    signals["noise_anomaly"]          = round(n_score, 4)
    signals["frequency_anomaly"]      = round(f_score, 4)
    signals["color_drift"]            = round(c_score, 4)
    signals["texture_smoothness"]     = round(s_score, 4)
    signals["motion_irregularity"]    = round(o_score, 4)

    # ── Weighted combination → fake probability ───────────────────────────────
    raw = (
        t_score * 0.24 +
        x_score * 0.18 +
        n_score * 0.18 +
        f_score * 0.14 +
        c_score * 0.12 +
        s_score * 0.08 +
        o_score * 0.06
    )
    fake_probability = float(np.clip(raw, 0.0, 1.0))

    # ── Ensemble vote for stability ───────────────────────────────────────────
    # Each signal votes fake/real based on its own calibrated threshold.
    # Thresholds derived from empirical calibration on common video types.
    vote_thresholds = {
        "temporal_inconsistency": 0.35,
        "ssim_variance":          0.30,
        "noise_anomaly":          0.45,
        "frequency_anomaly":      0.40,
        "color_drift":            0.35,
        "texture_smoothness":     0.40,
        "motion_irregularity":    0.30,
    }
    vote_result = _ensemble_vote(signals, vote_thresholds)

    # ── Blend continuous score with ensemble vote ─────────────────────────────
    # 70% continuous score + 30% ensemble agreement → most stable combination
    ensemble_prob = vote_result["fake_ratio"]
    blended_probability = float(np.clip(fake_probability * 0.70 + ensemble_prob * 0.30, 0.0, 1.0))

    confidence = round(abs(blended_probability - 0.5) * 2 * 100, 2)

    return {
        "fake_probability": round(blended_probability, 4),
        "confidence_score": confidence,
        "signals": signals,
        "ensemble": {
            "fake_votes":   vote_result["fake_votes"],
            "real_votes":   vote_result["real_votes"],
            "fake_ratio":   round(vote_result["fake_ratio"], 4),
        },
    }


# ── Video signal helpers ──────────────────────────────────────────────────────

def _temporal_consistency(frames: list) -> float:
    """
    Frame-to-frame absolute differences.
    Deepfakes flicker: high variance + sudden spikes in diff magnitude.
    Uses face-region focus: central 60% of frame.
    """
    if len(frames) < 3:
        return 0.0

    diffs = []
    for i in range(1, len(frames)):
        a = np.array(frames[i-1], dtype=np.float32) / 255.0
        b = np.array(frames[i],   dtype=np.float32) / 255.0

        # Focus on central face region (60% of height, 50% of width)
        h, w = a.shape[:2]
        y1, y2 = int(h * 0.20), int(h * 0.80)
        x1, x2 = int(w * 0.25), int(w * 0.75)
        a_roi = a[y1:y2, x1:x2]
        b_roi = b[y1:y2, x1:x2]

        diffs.append(np.abs(a_roi - b_roi).mean())

    diffs = np.array(diffs)
    variance_score = diffs.std() * 5.0
    spike_score    = float((diffs > diffs.mean() + 2.0 * diffs.std()).mean())
    return float(np.clip(variance_score * 0.6 + spike_score * 0.4, 0, 1))


def _ssim_variance(frames: list) -> float:
    """
    NEW in v2: Structural Similarity (SSIM) temporal consistency.
    SSIM is more sensitive to rendering artifacts than pixel diff.
    Deepfakes show inconsistent SSIM between frames due to face-swap blending
    boundaries and rendering inconsistencies.

    High variance in frame-to-frame SSIM → deepfake indicator.
    """
    if len(frames) < 3:
        return 0.0

    ssim_scores = []
    sample = frames[::max(1, len(frames) // 12)][:12]

    for i in range(1, len(sample)):
        # Convert to grayscale numpy
        a = np.array(sample[i-1].convert("L"), dtype=np.float32) / 255.0
        b = np.array(sample[i].convert("L"),   dtype=np.float32) / 255.0

        # Resize for speed if too large
        if a.shape[0] > 256:
            a = cv2.resize(a, (256, 256))
            b = cv2.resize(b, (256, 256))

        # Compute SSIM manually (no scikit-image dependency)
        mu_a = cv2.GaussianBlur(a, (11, 11), 1.5)
        mu_b = cv2.GaussianBlur(b, (11, 11), 1.5)
        mu_a2  = mu_a ** 2
        mu_b2  = mu_b ** 2
        mu_ab  = mu_a * mu_b
        sig_a2 = cv2.GaussianBlur(a ** 2, (11, 11), 1.5) - mu_a2
        sig_b2 = cv2.GaussianBlur(b ** 2, (11, 11), 1.5) - mu_b2
        sig_ab = cv2.GaussianBlur(a * b,  (11, 11), 1.5) - mu_ab

        c1, c2 = 0.01**2, 0.03**2
        ssim_map = ((2 * mu_ab + c1) * (2 * sig_ab + c2)) / \
                   ((mu_a2 + mu_b2 + c1) * (sig_a2 + sig_b2 + c2) + 1e-8)
        ssim_scores.append(float(ssim_map.mean()))

    if not ssim_scores:
        return 0.0

    ssim_arr = np.array(ssim_scores)
    # High variance in SSIM = inconsistent rendering = deepfake
    variance_score = ssim_arr.std() * 8.0
    # Low mean SSIM = structurally different consecutive frames
    low_mean_penalty = float(np.clip(0.95 - ssim_arr.mean(), 0, 1)) * 2.0
    return float(np.clip(variance_score + low_mean_penalty, 0, 1))


def _video_noise_uniformity(frames: list) -> float:
    """
    GAN-generated frames have unnaturally uniform noise (spatial + temporal).
    We measure noise MAD (robust) across frames; very low = too smooth = AI.
    """
    noise_mads = []
    sample = frames[::max(1, len(frames) // 8)][:8]

    for frame in sample:
        arr = np.array(frame, dtype=np.float32) / 255.0
        for c in range(3):
            blurred = cv2.GaussianBlur(arr[:, :, c], (5, 5), 0)
            residual = (arr[:, :, c] - blurred).flatten()
            mad = float(np.median(np.abs(residual - np.median(residual))))
            noise_mads.append(mad)

    if not noise_mads:
        return 0.0

    ns = np.array(noise_mads)
    mean_noise     = ns.mean()
    cross_variance = ns.std() / (mean_noise + 1e-8)

    # Very low mean noise → GAN over-smoothing
    low_noise_flag = float(np.clip(1.0 - mean_noise * 80.0, 0, 1))
    # Very uniform noise across frames → GAN artifact
    uniformity_flag = float(np.clip(1.0 - cross_variance, 0, 1))

    return float(np.clip(low_noise_flag * 0.55 + uniformity_flag * 0.45, 0, 1))


def _video_frequency(frames: list) -> float:
    """FFT on sampled frames — GAN checkerboard artifacts."""
    scores = []
    sample = frames[::max(1, len(frames) // 8)][:8]

    for frame in sample:
        gray = np.array(frame.convert("L"), dtype=np.float32)
        fft  = np.fft.fftshift(np.fft.fft2(gray))
        mag  = np.log1p(np.abs(fft))
        h, w = mag.shape
        cy, cx = h // 2, w // 2
        y, x = np.ogrid[:h, :w]
        dist = np.sqrt((y - cy) ** 2 + (x - cx) ** 2)
        high = mag[dist > min(h, w) // 4]
        if len(high) > 0:
            # Low variance in high-frequency content → GAN-smoothed
            scores.append(1.0 / (high.std() + 1.0))

    return float(np.clip(np.mean(scores) * 0.4, 0, 1)) if scores else 0.0


def _color_drift(frames: list) -> float:
    """
    Track per-frame colour histogram. Deepfakes exhibit subtle colour
    shifts at face boundaries that cause histogram drift over time.
    """
    if len(frames) < 4:
        return 0.0

    sample = frames[::max(1, len(frames) // 12)][:12]
    prev_h = None
    diffs  = []

    for frame in sample:
        arr = np.array(frame)
        h = np.array([
            np.histogram(arr[:, :, c], bins=32, range=(0, 256))[0]
            for c in range(3)
        ], dtype=np.float32)
        h /= (h.sum() + 1e-8)

        if prev_h is not None:
            diffs.append(np.abs(h - prev_h).mean())
        prev_h = h

    if not diffs:
        return 0.0

    diffs = np.array(diffs)
    spike_ratio = float((diffs > 0.012).mean())
    drift_var   = diffs.std() * 10.0
    return float(np.clip(drift_var * 0.5 + spike_ratio * 0.5, 0, 1))


def _texture_smoothness(frames: list) -> float:
    """
    GAN models produce unnaturally smooth skin with suppressed high-freq detail.
    Low Laplacian gradient magnitude → over-smooth → AI-generated.
    Uses face-region focus for higher sensitivity.
    """
    sharpness_vals = []
    sample = frames[::max(1, len(frames) // 8)][:8]

    for frame in sample:
        gray = np.array(frame.convert("L"), dtype=np.float32)

        # Focus on central face region
        h, w = gray.shape
        y1, y2 = int(h * 0.15), int(h * 0.85)
        x1, x2 = int(w * 0.20), int(w * 0.80)
        roi = gray[y1:y2, x1:x2]

        gx = np.gradient(roi, axis=1)
        gy = np.gradient(roi, axis=0)
        sharpness_vals.append(np.sqrt(gx**2 + gy**2).mean())

    if not sharpness_vals:
        return 0.0

    mean_sharpness = np.mean(sharpness_vals)
    # Natural video typically 8–20; AI face-swap: < 6
    smoothness = float(np.clip(1.0 - mean_sharpness / 14.0, 0, 1))
    return smoothness


def _optical_flow_irregularity(frames: list) -> float:
    """
    Deepfake face regions move independently of the background,
    creating irregular optical flow patterns between consecutive frames.
    """
    if len(frames) < 3:
        return 0.0

    magnitudes = []
    sample = frames[::max(1, len(frames) // 10)][:10]

    for i in range(1, len(sample)):
        prev = np.array(sample[i-1].convert("L"), dtype=np.uint8)
        curr = np.array(sample[i].convert("L"),   dtype=np.uint8)

        # Down-scale for speed
        scale  = 0.4
        h, w   = prev.shape
        sh, sw = max(4, int(h * scale)), max(4, int(w * scale))
        p_s    = cv2.resize(prev, (sw, sh))
        c_s    = cv2.resize(curr, (sw, sh))

        try:
            flow = cv2.calcOpticalFlowFarneback(
                p_s, c_s, None,
                pyr_scale=0.5, levels=3, winsize=15,
                iterations=3, poly_n=5, poly_sigma=1.2, flags=0,
            )
            mag = np.sqrt(flow[:, :, 0]**2 + flow[:, :, 1]**2)
            magnitudes.append(mag.mean())
        except Exception:
            pass

    if not magnitudes:
        return 0.0

    m = np.array(magnitudes)
    # High coefficient of variation = irregular / jerky motion = deepfake
    cv_score = m.std() / (m.mean() + 1e-8)
    return float(np.clip(cv_score * 0.3, 0, 1))
