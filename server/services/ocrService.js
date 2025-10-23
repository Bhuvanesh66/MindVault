const Tesseract = require("tesseract.js");
const logger = require("../utils/logger");

/**
 * ========================================
 * OCR SERVICE
 * ========================================
 *
 * Extracts text from images using Tesseract
 * Supports: JPG, PNG, GIF, WEBP, etc.
 *
 * Tesseract is open-source - completely FREE!
 * No API costs!
 */

class OCRService {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
  }

  /**
   * Initialize Tesseract worker
   * Worker is a background process that does OCR
   * Call this ONCE when server starts
   */
  async initialize() {
    try {
      if (this.isInitialized && this.worker) {
        logger.info("✅ Tesseract worker already initialized");
        return this.worker;
      }

      logger.info("🔄 Initializing Tesseract OCR worker...");

      // Create Tesseract worker for English language
      this.worker = await Tesseract.createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            logger.debug(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      this.isInitialized = true;

      logger.info("✅ Tesseract worker initialized successfully");
      return this.worker;
    } catch (error) {
      logger.error(`❌ Tesseract initialization error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract text from image file
   * @param {Buffer} imageBuffer - Image file as buffer
   * @param {string} fileName - Original filename
   * @returns {Promise<Object>} - Extracted text and metadata
   */
  async extractText(imageBuffer, fileName) {
    try {
      logger.info(`📸 Extracting text from image: ${fileName}`);

      // Initialize worker if needed
      if (!this.worker) {
        await this.initialize();
      }

      // Perform OCR
      const {
        data: { text, confidence, lines },
      } = await this.worker.recognize(imageBuffer);

      const extractedText = text.trim();

      logger.info(
        `✅ OCR completed: ${extractedText.length} characters extracted`
      );

      return {
        success: true,
        text: extractedText,
        confidence: Math.round(confidence),
        lineCount: lines?.length || 0,
        fileName: fileName,
        processedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`❌ OCR error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract text with detailed information
   * Returns confidence scores per word
   * @param {Buffer} imageBuffer - Image file as buffer
   * @returns {Promise<Object>} - Detailed extraction data
   */
  async extractTextWithDetails(imageBuffer) {
    try {
      logger.info("📸 Extracting text with detailed analysis...");

      if (!this.worker) {
        await this.initialize();
      }

      const result = await this.worker.recognize(imageBuffer);
      const { data } = result;

      return {
        success: true,
        fullText: data.text.trim(),
        confidence: Math.round(data.confidence),
        words: data.words.map((word) => ({
          text: word.text,
          confidence: Math.round(word.confidence),
        })),
        paragraphs: data.paragraphs?.length || 0,
        lines: data.lines?.length || 0,
        blocks: data.blocks?.length || 0,
      };
    } catch (error) {
      logger.error(`❌ Detailed extraction error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Batch process multiple images
   * @param {Array<Buffer>} imageBuffers - Array of image buffers
   * @returns {Promise<Array>} - Array of extraction results
   */
  async batchExtractText(imageBuffers) {
    try {
      logger.info(`📸 Batch processing ${imageBuffers.length} images...`);

      if (!this.worker) {
        await this.initialize();
      }

      const results = await Promise.all(
        imageBuffers.map(async (buffer, index) => {
          try {
            const result = await this.extractText(buffer, `image_${index}`);
            return result;
          } catch (error) {
            logger.warn(`Failed to process image ${index}: ${error.message}`);
            return {
              success: false,
              error: error.message,
              index,
            };
          }
        })
      );

      const successful = results.filter((r) => r.success).length;
      logger.info(
        `✅ Batch processing complete: ${successful}/${imageBuffers.length} successful`
      );

      return {
        success: true,
        totalImages: imageBuffers.length,
        successfulProcessed: successful,
        results: results,
      };
    } catch (error) {
      logger.error(`❌ Batch extraction error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Terminate worker to free memory
   * Call this when server shuts down
   */
  async terminate() {
    try {
      if (this.worker) {
        logger.info("🛑 Terminating Tesseract worker...");
        await this.worker.terminate();
        this.worker = null;
        this.isInitialized = false;
        logger.info("✅ Tesseract worker terminated");
      }
    } catch (error) {
      logger.error(`❌ Termination error: ${error.message}`);
    }
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      workerActive: this.worker !== null,
      status: this.isInitialized ? "ready" : "not initialized",
    };
  }
}

// Export singleton instance
module.exports = new OCRService();
