const multer = require("multer");
const logger = require("../utils/logger");

/**
 * ========================================
 * UPLOAD MIDDLEWARE
 * ========================================
 *
 * This middleware:
 * 1. Handles file uploads from client
 * 2. Stores files in memory (sent to Supabase)
 * 3. Validates file type and size
 * 4. Attaches file data to request
 *
 * Usage in routes:
 * router.post('/upload', protect, upload.single('file'), uploadController);
 */

/**
 * FILE FILTER: Validate file types
 */
const fileFilter = (req, file, cb) => {
  // List of allowed MIME types
  const allowedTypes = [
    // Images
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",

    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",

    // Videos
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",

    // Audio
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/webm",
    "audio/ogg",
    "audio/aac",
  ];

  // Check if file type is allowed
  if (allowedTypes.includes(file.mimetype)) {
    logger.info(`✅ File accepted: ${file.originalname} (${file.mimetype})`);
    cb(null, true); // Accept file
  } else {
    logger.warn(`❌ File rejected: ${file.originalname} (${file.mimetype})`);
    cb(
      new Error(
        `Invalid file type: ${file.mimetype}. Allowed types: images, PDFs, videos, and audio files`
      ),
      false // Reject file
    );
  }
};

/**
 * MULTER CONFIGURATION
 * Store files in memory and send to Supabase
 */
const upload = multer({
  // Use memory storage (not disk)
  // Files are stored as buffers in req.file.buffer
  storage: multer.memoryStorage(),

  // Apply file filter
  fileFilter: fileFilter,

  // File size limits
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
});

/**
 * CUSTOM ERROR HANDLER for upload errors
 */
const uploadErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    logger.error(`Multer error: ${err.message}`);

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 100MB",
      });
    }

    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files. Maximum is 1 file per upload",
      });
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: "Unexpected file field",
      });
    }

    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  }

  // Handle other errors (from fileFilter)
  if (err) {
    logger.error(`Upload error: ${err.message}`);
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  next();
};

/**
 * HELPER: Get file size in readable format
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

/**
 * HELPER: Get content type from file
 */
const getContentType = (mimetype) => {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("audio/")) return "audio";
  if (mimetype === "application/pdf") return "pdf";
  return "document";
};

module.exports = {
  upload,
  uploadErrorHandler,
  formatFileSize,
  getContentType,
};
