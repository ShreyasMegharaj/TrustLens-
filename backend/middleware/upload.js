const multer = require("multer");
const path   = require("path");

const ALLOWED_VIDEO = [".mp4", ".avi", ".mov", ".mkv", ".webm"];
const ALLOWED_IMAGE = [".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"];
const ALL_ALLOWED   = [...ALLOWED_VIDEO, ...ALLOWED_IMAGE];

// Use memory storage — we stream bytes to the ML service, no disk needed
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALL_ALLOWED.includes(ext)) {
      cb(null, true);
    } else {
      // multer v2: pass an error with status for proper HTTP response
      const err = new Error(
        `Unsupported file type: ${ext}. Allowed: ${ALL_ALLOWED.join(", ")}`
      );
      err.status = 400;
      cb(err, false);
    }
  },
});

module.exports = { upload, ALLOWED_VIDEO, ALLOWED_IMAGE };
