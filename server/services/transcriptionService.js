const fs = require("fs");
const path = require("path");
const { openai } = require("../config/openai");
const logger = require("../utils/logger");

/**
 * ========================================
 * TRANSCRIPTION SERVICE
 * ========================================
 *
 * Converts audio/video to text using OpenAI Whisper
 * Supports: MP3, WAV, M4A, AAC, OGG, FLAC
 * Video: MP4, MPEG, MOV, WEBM, MKV
 *
 * Cost: ~$0.006 per minute of audio
 */

class TranscriptionService {
  /**
   * Transcribe audio/video file to text
   * @param {Buffer} fileBuffer - Audio/video file as buffer
   * @param {string} fileName - Original filename
   * @param {string} language - Language code (default: 'en')
   * @returns {Promise<Object>} - Transcribed text
   */
  async transcribeAudio(fileBuffer, fileName, language = "en") {
    try {
      // Validate input
      if (!fileBuffer) throw new Error("File buffer is required");
      if (!fileName) throw new Error("File name is required");

      const fileSizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);
      logger.info(
        `🎙️  Transcribing audio: ${fileName} (${fileSizeMB}MB, ${language})`
      );

      // Check file size (max 25MB for Whisper API)
      if (fileBuffer.length > 25 * 1024 * 1024) {
        throw new Error("File too large. Whisper API has 25MB limit.");
      }

      // Create a temporary file path
      const tempFilePath = path.join(__dirname, `../temp/${fileName}`);

      // Ensure temp directory exists
      const tempDir = path.join(__dirname, "../temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Write buffer to temporary file
      fs.writeFileSync(tempFilePath, fileBuffer);

      try {
        // Create file stream for upload
        const fileStream = fs.createReadStream(tempFilePath);

        // Call Whisper API
        const transcription = await openai.audio.transcriptions.create({
          file: fileStream,
          model: "whisper-1",
          language: language, // Specify language for better accuracy
          response_format: "text", // Return as plain text
        });

        logger.info(
          `✅ Transcription completed: ${transcription.length} characters`
        );

        return {
          success: true,
          text: transcription.trim(),
          fileName: fileName,
          language: language,
          duration: fileSizeMB, // Approximate duration based on file size
          transcribedAt: new Date().toISOString(),
        };
      } finally {
        // Clean up temporary file
        try {
          fs.unlinkSync(tempFilePath);
          logger.info("🗑️  Temporary file cleaned up");
        } catch (cleanupError) {
          logger.warn(`Failed to delete temp file: ${cleanupError.message}`);
        }
      }
    } catch (error) {
      logger.error(`❌ Transcription error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Transcribe with detailed information (includes timestamps)
   * @param {Buffer} fileBuffer - Audio/video file buffer
   * @param {string} fileName - Original filename
   * @returns {Promise<Object>} - Detailed transcription with timestamps
   */
  async transcribeWithDetails(fileBuffer, fileName) {
    try {
      logger.info(`🎙️  Detailed transcription: ${fileName}`);

      if (!fileBuffer) throw new Error("File buffer is required");

      // Create temporary file
      const tempFilePath = path.join(__dirname, `../temp/${fileName}`);
      const tempDir = path.join(__dirname, "../temp");

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      fs.writeFileSync(tempFilePath, fileBuffer);

      try {
        const fileStream = fs.createReadStream(tempFilePath);

        // Request verbose output with timestamps
        const transcription = await openai.audio.transcriptions.create({
          file: fileStream,
          model: "whisper-1",
          language: "en",
          response_format: "verbose_json", // Detailed output
        });

        logger.info(`✅ Detailed transcription completed`);

        return {
          success: true,
          text: transcription.text,
          language: transcription.language,
          duration: transcription.duration, // Duration in seconds
          segments: transcription.segments || [], // Each segment with timestamp
          fileName: fileName,
        };
      } finally {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupError) {
          logger.warn(`Failed to clean temp file: ${cleanupError.message}`);
        }
      }
    } catch (error) {
      logger.error(`❌ Detailed transcription error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Translate audio to English (even if original is another language)
   * @param {Buffer} fileBuffer - Audio/video file buffer
   * @param {string} fileName - Original filename
   * @returns {Promise<string>} - Translated English text
   */
  async translateToEnglish(fileBuffer, fileName) {
    try {
      logger.info(`🌍 Translating audio to English: ${fileName}`);

      if (!fileBuffer) throw new Error("File buffer is required");

      const tempFilePath = path.join(__dirname, `../temp/${fileName}`);
      const tempDir = path.join(__dirname, "../temp");

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      fs.writeFileSync(tempFilePath, fileBuffer);

      try {
        const fileStream = fs.createReadStream(tempFilePath);

        // Use Whisper translation endpoint
        const translation = await openai.audio.translations.create({
          file: fileStream,
          model: "whisper-1",
        });

        logger.info(
          `✅ Translation completed: ${translation.text.length} characters`
        );

        return {
          success: true,
          translatedText: translation.text.trim(),
          translatedTo: "English",
          fileName: fileName,
        };
      } finally {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupError) {
          logger.warn(`Failed to clean temp file: ${cleanupError.message}`);
        }
      }
    } catch (error) {
      logger.error(`❌ Translation error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Batch transcribe multiple files
   * @param {Array<{buffer: Buffer, fileName: string}>} files - Array of files
   * @returns {Promise<Array>} - Transcription results
   */
  async batchTranscribe(files) {
    try {
      logger.info(`🎙️  Batch transcribing ${files.length} files...`);

      const results = await Promise.all(
        files.map(async ({ buffer, fileName }) => {
          try {
            const result = await this.transcribeAudio(buffer, fileName);
            return result;
          } catch (error) {
            logger.warn(`Failed to transcribe ${fileName}: ${error.message}`);
            return {
              success: false,
              fileName,
              error: error.message,
            };
          }
        })
      );

      const successful = results.filter((r) => r.success).length;
      logger.info(
        `✅ Batch transcription complete: ${successful}/${files.length} successful`
      );

      return {
        success: true,
        totalFiles: files.length,
        successfulTranscribed: successful,
        results: results,
      };
    } catch (error) {
      logger.error(`❌ Batch transcription error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get supported file formats
   */
  getSupportedFormats() {
    return {
      audio: ["mp3", "mpeg", "wav", "m4a", "aac", "ogg", "flac", "webm"],
      video: ["mp4", "mpeg", "mov", "webm", "mkv", "avi", "flv"],
      maxFileSize: "25MB",
      maxDuration: "No limit (file size is limiting factor)",
    };
  }
}

// Export singleton
module.exports = new TranscriptionService();
