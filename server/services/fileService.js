const supabaseService = require("./supabaseService");
const ocrService = require("./ocrService");
const transcriptionService = require("./transcriptionService");
const embeddingService = require("./embeddingService");
const logger = require("../utils/logger");

/**
 * ========================================
 * FILE SERVICE
 * ========================================
 *
 * Orchestrates file operations:
 * 1. Upload to Supabase
 * 2. Extract content (OCR, transcription)
 * 3. Generate embeddings
 * 4. Return processed data
 */

class FileService {
  /**
   * Process uploaded file completely
   * 1. Upload to Supabase
   * 2. Extract text (OCR for images, transcription for audio/video)
   * 3. Generate embeddings
   * @param {Object} file - Multer file object
   * @param {string} userId - User ID
   * @param {string} title - Content title
   * @returns {Promise<Object>} - Processed file data
   */
  async processUploadedFile(file, userId, title) {
    try {
      logger.info(`📁 Processing file: ${file.originalname}`);

      const fileType = this.getFileType(file.mimetype);
      let extractedText = "";
      let metadata = {};

      // STEP 1: Upload file to Supabase
      logger.info("📤 Step 1: Uploading to Supabase...");
      const uploadResult = await supabaseService.uploadFile(
        file.buffer,
        file.originalname,
        userId,
        file.mimetype
      );

      if (!uploadResult.success) {
        throw new Error("File upload failed");
      }

      metadata = {
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedUrl: uploadResult.url,
        uploadedPath: uploadResult.path,
      };

      // STEP 2: Extract text based on file type
      logger.info(`📋 Step 2: Extracting text (type: ${fileType})...`);

      if (fileType === "image") {
        // OCR for images
        const ocrResult = await ocrService.extractText(
          file.buffer,
          file.originalname
        );
        if (ocrResult.success) {
          extractedText = ocrResult.text;
          metadata.ocrConfidence = ocrResult.confidence;
        }
      } else if (fileType === "audio" || fileType === "video") {
        // Transcription for audio/video
        const transcribeResult = await transcriptionService.transcribeAudio(
          file.buffer,
          file.originalname
        );
        if (transcribeResult.success) {
          extractedText = transcribeResult.text;
          metadata.transcribedAt = transcribeResult.transcribedAt;
        }
      } else if (fileType === "document" || fileType === "pdf") {
        // For PDFs, we would need additional libraries
        // For now, just upload
        logger.warn("PDF text extraction not yet implemented");
      }

      // STEP 3: Generate embedding from title + extracted text
      logger.info("🔢 Step 3: Generating embedding...");

      const contentForEmbedding = `${title} ${extractedText}`;
      const embeddingResult = await embeddingService.generateEmbedding(
        contentForEmbedding
      );

      logger.info(`✅ File processing complete`);

      return {
        success: true,
        file: {
          originalName: file.originalname,
          size: file.size,
          type: fileType,
          uploadedUrl: uploadResult.url,
          uploadedPath: uploadResult.path,
        },
        extracted: {
          text: extractedText,
          length: extractedText.length,
          preview: extractedText.substring(0, 200), // First 200 chars
        },
        embedding: {
          vector: embeddingResult.embedding,
          dimensions: embeddingResult.dimensions,
        },
        metadata: metadata,
        processedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`❌ File processing error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Determine file type from MIME type
   */
  getFileType(mimetype) {
    if (mimetype.startsWith("image/")) return "image";
    if (mimetype.startsWith("video/")) return "video";
    if (mimetype.startsWith("audio/")) return "audio";
    if (mimetype === "application/pdf") return "pdf";
    if (mimetype.includes("document") || mimetype.includes("word"))
      return "document";
    return "unknown";
  }

  /**
   * Delete file and clean up
   */
  async deleteFile(filePath) {
    try {
      logger.info(`🗑️  Deleting file: ${filePath}`);

      const deleteResult = await supabaseService.deleteFile(filePath);

      if (deleteResult.success) {
        logger.info(`✅ File deleted successfully`);
        return { success: true };
      }
    } catch (error) {
      logger.error(`❌ Delete error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get file processing capabilities
   */
  getCapabilities() {
    return {
      fileTypes: {
        images: ["jpg", "jpeg", "png", "gif", "webp"],
        audio: ["mp3", "wav", "m4a", "aac", "ogg"],
        video: ["mp4", "mpeg", "mov", "webm"],
        documents: ["pdf", "doc", "docx", "txt"],
      },
      processing: {
        images: "OCR - Extract text using Tesseract",
        audio: "Transcription - Convert audio to text using Whisper",
        video: "Transcription - Extract audio and convert to text",
        documents: "Embedding generation for search",
      },
      limits: {
        maxFileSize: "100MB",
        whisperLimit: "25MB",
      },
      features: [
        "Automatic text extraction",
        "Vector embedding generation",
        "Supabase storage integration",
        "Batch processing",
      ],
    };
  }
}

// Export singleton
module.exports = new FileService();
