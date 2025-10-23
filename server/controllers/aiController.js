const embeddingService = require("../services/embeddingService");
const ocrService = require("../services/ocrService");
const transcriptionService = require("../services/transcriptionService");
const fileService = require("../services/fileService");
const { openai } = require("../config/openai");
const Content = require("../models/Content");
const logger = require("../utils/logger");

/**
 * ========================================
 * AI CONTROLLER
 * ========================================
 *
 * Handles all AI-powered operations:
 * - Text embeddings
 * - Content summarization
 * - Image OCR
 * - Audio/video transcription
 * - Batch AI operations
 */

/**
 * GENERATE EMBEDDING: Convert text to vector
 * POST /api/ai/embeddings
 */
exports.generateEmbedding = async (req, res, next) => {
  try {
    const { text } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        message: "Text is required and must be a string",
      });
    }

    if (text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Text cannot be empty",
      });
    }

    logger.info(`🔢 Generating embedding for user: ${userId}`);

    // Generate embedding
    const result = await embeddingService.generateEmbedding(text);

    if (!result.success) {
      throw new Error("Failed to generate embedding");
    }

    logger.info(`✅ Embedding generated: ${result.dimensions} dimensions`);

    res.status(200).json({
      success: true,
      data: {
        embedding: result.embedding,
        dimensions: result.dimensions,
        inputLength: result.inputLength,
        tokensUsed: result.tokens,
      },
    });
  } catch (error) {
    logger.error(`Embedding error: ${error.message}`);
    next(error);
  }
};

/**
 * GENERATE SUMMARY: AI-powered content summarization
 * POST /api/ai/summarize
 */
exports.generateSummary = async (req, res, next) => {
  try {
    const { text, maxLength = 200 } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        message: "Text is required and must be a string",
      });
    }

    if (text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Text cannot be empty",
      });
    }

    logger.info(`📝 Generating summary for user: ${userId}`);

    // Create summary using GPT
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that creates concise summaries. 
                   Create a summary in maximum ${maxLength} characters.
                   Be clear and capture the main points.`,
        },
        {
          role: "user",
          content: `Please summarize the following text:\n\n${text.slice(
            0,
            2000
          )}`,
        },
      ],
      max_tokens: Math.ceil(maxLength / 4), // Approximate tokens needed
      temperature: 0.7,
    });

    const summary = completion.choices[0].message.content.trim();

    logger.info(`✅ Summary generated: ${summary.length} characters`);

    res.status(200).json({
      success: true,
      data: {
        summary,
        originalLength: text.length,
        summaryLength: summary.length,
        reductionPercentage: Math.round(
          (1 - summary.length / text.length) * 100
        ),
      },
    });
  } catch (error) {
    logger.error(`Summary error: ${error.message}`);
    next(error);
  }
};

/**
 * EXTRACT TEXT FROM IMAGE: OCR
 * POST /api/ai/ocr
 */
exports.extractImageText = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Check if file is uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image file is required",
      });
    }

    // Validate file type
    if (!req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({
        success: false,
        message: "File must be an image",
      });
    }

    logger.info(`📸 Extracting text from image: ${req.file.originalname}`);

    // Extract text using OCR
    const ocrResult = await ocrService.extractText(
      req.file.buffer,
      req.file.originalname
    );

    if (!ocrResult.success) {
      throw new Error("OCR extraction failed");
    }

    logger.info(`✅ OCR completed: ${ocrResult.text.length} characters`);

    res.status(200).json({
      success: true,
      data: {
        text: ocrResult.text,
        fileName: ocrResult.fileName,
        confidence: ocrResult.confidence,
        lineCount: ocrResult.lineCount,
        characterCount: ocrResult.text.length,
      },
    });
  } catch (error) {
    logger.error(`OCR error: ${error.message}`);
    next(error);
  }
};

/**
 * TRANSCRIBE AUDIO: Convert audio/video to text
 * POST /api/ai/transcribe
 */
exports.transcribeAudio = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Check if file is uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Audio or video file is required",
      });
    }

    // Validate file type
    const isAudio = req.file.mimetype.startsWith("audio/");
    const isVideo = req.file.mimetype.startsWith("video/");

    if (!isAudio && !isVideo) {
      return res.status(400).json({
        success: false,
        message: "File must be audio or video",
      });
    }

    logger.info(`🎙️  Transcribing: ${req.file.originalname}`);

    // Transcribe using Whisper
    const transcribeResult = await transcriptionService.transcribeAudio(
      req.file.buffer,
      req.file.originalname
    );

    if (!transcribeResult.success) {
      throw new Error("Transcription failed");
    }

    logger.info(
      `✅ Transcription completed: ${transcribeResult.text.length} characters`
    );

    res.status(200).json({
      success: true,
      data: {
        text: transcribeResult.text,
        fileName: transcribeResult.fileName,
        language: transcribeResult.language,
        characterCount: transcribeResult.text.length,
        wordCount: transcribeResult.text.split(/\s+/).length,
      },
    });
  } catch (error) {
    logger.error(`Transcription error: ${error.message}`);
    next(error);
  }
};

/**
 * BATCH GENERATE EMBEDDINGS: Create embeddings for multiple texts
 * POST /api/ai/batch-embeddings
 */
exports.batchEmbeddings = async (req, res, next) => {
  try {
    const { texts } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Texts must be a non-empty array",
      });
    }

    if (texts.length > 10) {
      return res.status(400).json({
        success: false,
        message: "Maximum 10 texts per batch",
      });
    }

    logger.info(`🔢 Batch embedding ${texts.length} texts for user: ${userId}`);

    // Generate embeddings for each text
    const result = await embeddingService.generateBatchEmbeddings(texts);

    logger.info(
      `✅ Batch embeddings: ${result.successful}/${result.total} successful`
    );

    res.status(200).json({
      success: true,
      data: {
        total: result.total,
        successful: result.successful,
        embeddings: result.embeddings,
      },
    });
  } catch (error) {
    logger.error(`Batch embedding error: ${error.message}`);
    next(error);
  }
};

/**
 * BATCH OCR: Process multiple images
 * POST /api/ai/batch-ocr
 */
exports.batchOCR = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Check if files are uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one image file is required",
      });
    }

    if (req.files.length > 5) {
      return res.status(400).json({
        success: false,
        message: "Maximum 5 images per batch",
      });
    }

    logger.info(`📸 Batch OCR processing ${req.files.length} images`);

    // Extract buffers from files
    const imageBuffers = req.files.map((f) => f.buffer);

    // Process batch
    const result = await ocrService.batchExtractText(imageBuffers);

    if (!result.success) {
      throw new Error("Batch OCR failed");
    }

    logger.info(
      `✅ Batch OCR: ${result.successfulProcessed}/${result.totalImages} successful`
    );

    res.status(200).json({
      success: true,
      data: {
        total: result.totalImages,
        successful: result.successfulProcessed,
        results: result.results.map((r) => ({
          text: r.text,
          confidence: r.confidence,
          success: r.success,
        })),
      },
    });
  } catch (error) {
    logger.error(`Batch OCR error: ${error.message}`);
    next(error);
  }
};

/**
 * BATCH TRANSCRIBE: Process multiple audio files
 * POST /api/ai/batch-transcribe
 */
exports.batchTranscribe = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Check if files are uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one audio file is required",
      });
    }

    if (req.files.length > 5) {
      return res.status(400).json({
        success: false,
        message: "Maximum 5 files per batch",
      });
    }

    logger.info(`🎙️  Batch transcribing ${req.files.length} files`);

    // Create file objects with buffers
    const files = req.files.map((f) => ({
      buffer: f.buffer,
      fileName: f.originalname,
    }));

    // Process batch
    const result = await transcriptionService.batchTranscribe(files);

    if (!result.success) {
      throw new Error("Batch transcription failed");
    }

    logger.info(
      `✅ Batch transcribe: ${result.successfulTranscribed}/${result.totalFiles} successful`
    );

    res.status(200).json({
      success: true,
      data: {
        total: result.totalFiles,
        successful: result.successfulTranscribed,
        results: result.results.map((r) => ({
          text: r.text,
          fileName: r.fileName,
          success: r.success,
        })),
      },
    });
  } catch (error) {
    logger.error(`Batch transcribe error: ${error.message}`);
    next(error);
  }
};

/**
 * ANALYZE CONTENT: Generate summary + embedding + auto-tags
 * POST /api/ai/analyze
 */
exports.analyzeContent = async (req, res, next) => {
  try {
    const { contentId } = req.body;
    const userId = req.user.id;

    if (!contentId) {
      return res.status(400).json({
        success: false,
        message: "Content ID is required",
      });
    }

    logger.info(`🔍 Analyzing content: ${contentId}`);

    // Get content
    const content = await Content.findOne({
      _id: contentId,
      user: userId,
    });

    if (!content) {
      return res.status(404).json({
        success: false,
        message: "Content not found",
      });
    }

    const analysis = {};

    // Generate summary if text exists
    if (content.originalText && !content.summary) {
      try {
        const summaryCompletion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "Create a brief 1-2 sentence summary.",
            },
            {
              role: "user",
              content: `Summarize: ${content.originalText.slice(0, 1000)}`,
            },
          ],
          max_tokens: 100,
        });

        analysis.summary = summaryCompletion.choices[0].message.content.trim();
        content.summary = analysis.summary;
      } catch (summaryError) {
        logger.warn(`Summary generation failed: ${summaryError.message}`);
      }
    }

    // Generate embedding if not exists
    if (!content.embedding || content.embedding.length === 0) {
      try {
        const embeddingResult = await embeddingService.generateContentEmbedding(
          content
        );
        analysis.embedding = {
          dimensions: embeddingResult.dimensions,
          generated: true,
        };
        content.embedding = embeddingResult.embedding;
      } catch (embError) {
        logger.warn(`Embedding generation failed: ${embError.message}`);
      }
    }

    // Generate auto-tags
    if (
      content.originalText &&
      (!content.autoTags || content.autoTags.length === 0)
    ) {
      try {
        const tagCompletion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content:
                "Extract 5-10 relevant tags from the text. Return as comma-separated list.",
            },
            {
              role: "user",
              content: `Extract tags from: ${content.originalText.slice(
                0,
                500
              )}`,
            },
          ],
          max_tokens: 50,
        });

        const tagsText = tagCompletion.choices[0].message.content.trim();
        analysis.autoTags = tagsText
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .slice(0, 10);

        content.autoTags = analysis.autoTags;
      } catch (tagError) {
        logger.warn(`Tag generation failed: ${tagError.message}`);
      }
    }

    // Save updated content
    await content.save();

    logger.info(`✅ Content analysis complete`);

    res.status(200).json({
      success: true,
      data: {
        contentId,
        analysis,
        updated: {
          summary: !!analysis.summary,
          embedding: !!analysis.embedding,
          autoTags: (analysis.autoTags?.length || 0) > 0,
        },
      },
    });
  } catch (error) {
    logger.error(`Content analysis error: ${error.message}`);
    next(error);
  }
};

/**
 * GET AI CAPABILITIES: Show what AI features are available
 * GET /api/ai/capabilities
 */
exports.getCapabilities = async (req, res, next) => {
  try {
    logger.info("📊 Retrieving AI capabilities");

    const capabilities = {
      embeddings: {
        enabled: true,
        model: "text-embedding-3-small",
        dimensions: 1536,
        description: "Convert text to vectors for semantic search",
        maxTextLength: "8000 characters",
        cost: "~$0.02 per 1M tokens",
      },
      summarization: {
        enabled: true,
        model: "gpt-3.5-turbo",
        description: "AI-powered content summarization",
        maxInputLength: "2000 characters",
        cost: "~$0.50 per 1M input tokens",
      },
      ocr: {
        enabled: true,
        model: "Tesseract",
        description: "Extract text from images",
        supportedFormats: ["jpg", "jpeg", "png", "gif", "webp"],
        cost: "FREE (open-source)",
      },
      transcription: {
        enabled: true,
        model: "Whisper",
        description: "Convert audio/video to text",
        supportedFormats: [
          "mp3",
          "wav",
          "m4a",
          "aac",
          "ogg",
          "flac",
          "webm",
          "mp4",
        ],
        maxFileSize: "25MB",
        cost: "~$0.006 per minute",
      },
      batchOperations: {
        enabled: true,
        maxBatchSize: 10,
        supported: ["embeddings", "ocr", "transcription"],
      },
      contentAnalysis: {
        enabled: true,
        features: ["summary generation", "auto-embedding", "auto-tagging"],
        description: "Comprehensive content analysis",
      },
    };

    res.status(200).json({
      success: true,
      data: {
        capabilities,
        rateLimit: "Standard OpenAI rate limits apply",
        documentation: "/api/docs/ai",
      },
    });
  } catch (error) {
    logger.error(`Get capabilities error: ${error.message}`);
    next(error);
  }
};
