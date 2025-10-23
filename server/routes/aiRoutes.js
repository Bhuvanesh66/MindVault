const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const { protect } = require("../middleware/authMiddleware");
const {upload} = require("../middleware/uploadMiddleware");

// All routes protected
router.use(protect);

// Embeddings
router.post("/embeddings", aiController.generateEmbedding);
router.post("/batch-embeddings", aiController.batchEmbeddings);

// Summarization
router.post("/summarize", aiController.generateSummary);

// OCR (Image to text)
router.post("/ocr", upload.single("image"), aiController.extractImageText);
router.post("/batch-ocr", upload.array("images", 5), aiController.batchOCR);

// Transcription (Audio/Video to text)
router.post(
  "/transcribe",
  upload.single("audio"),
  aiController.transcribeAudio
);
router.post(
  "/batch-transcribe",
  upload.array("files", 5),
  aiController.batchTranscribe
);

// Content Analysis
router.post("/analyze", aiController.analyzeContent);

// Capabilities
router.get("/capabilities", aiController.getCapabilities);

module.exports = router;
