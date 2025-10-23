const Content = require("../models/Content");
const Tag = require("../models/Tag");
const supabaseService = require("../services/supabaseService");
const embeddingService = require("../services/embeddingService");
const fileService = require("../services/fileService");
const logger = require("../utils/logger");
const { openai } = require("../config/openai");

/**
 * CREATE CONTENT: Upload and process file
 */
exports.createContent = async (req, res, next) => {
  try {
    const { title, description, contentType, tags } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!title || !contentType) {
      return res.status(400).json({
        success: false,
        message: "Title and content type are required",
      });
    }

    let fileUrl = null;
    let originalText = "";
    let embedding = [];
    let metadata = {};

    // Process file if uploaded
    if (req.file) {
      try {
        const processedFile = await fileService.processUploadedFile(
          req.file,
          userId,
          title
        );

        fileUrl = processedFile.file.uploadedUrl;
        originalText = processedFile.extracted.text;
        embedding = processedFile.embedding.vector;
        metadata = processedFile.metadata;

        logger.info(`✅ File processed: ${req.file.originalname}`);
      } catch (fileError) {
        logger.error(`File processing error: ${fileError.message}`);
        return res.status(400).json({
          success: false,
          message: `File processing failed: ${fileError.message}`,
        });
      }
    } else {
      // No file, generate embedding from title and description only
      const textForEmbedding = `${title} ${description || ""}`.trim();
      if (textForEmbedding.length > 0) {
        const embResult = await embeddingService.generateEmbedding(
          textForEmbedding
        );
        embedding = embResult.embedding;
      }
    }

    // Generate summary using GPT
    let summary = "";
    const textForSummary = [title, description, originalText]
      .filter(Boolean)
      .join(" ")
      .slice(0, 500);

    if (textForSummary.length > 50) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "Create a brief 1-2 sentence summary.",
            },
            { role: "user", content: `Summarize: ${textForSummary}` },
          ],
          max_tokens: 100,
        });
        summary = completion.choices[0].message.content;
      } catch (summaryError) {
        logger.warn(`Summary generation failed: ${summaryError.message}`);
      }
    }

    // Create content document
    const content = await Content.create({
      user: userId,
      title,
      description: description || "",
      contentType,
      fileUrl,
      originalText,
      summary,
      embedding,
      metadata,
    });

    // Add tags if provided
    if (tags && Array.isArray(tags) && tags.length > 0) {
      const tagDocs = await Promise.all(
        tags.map(async (tagName) => {
          let tag = await Tag.findOne({
            name: tagName.toLowerCase(),
            user: userId,
          });
          if (!tag) {
            tag = await Tag.create({
              name: tagName.toLowerCase(),
              user: userId,
            });
          }
          return tag._id;
        })
      );
      content.tags = tagDocs;
      await content.save();
    }

    logger.info(`✅ Content created: ${title}`);

    res.status(201).json({
      success: true,
      data: { content },
    });
  } catch (error) {
    logger.error(`Create content error: ${error.message}`);
    next(error);
  }
};

/**
 * GET ALL CONTENT: List user's content
 */
exports.getContents = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, contentType, isFavorite } = req.query;
    const userId = req.user.id;

    // Build filter
    const filter = { user: userId };
    if (contentType) filter.contentType = contentType;
    if (isFavorite !== undefined) filter.isFavorite = isFavorite === "true";

    // Get total count
    const total = await Content.countDocuments(filter);

    // Get paginated content
    const contents = await Content.find(filter)
      .populate("tags", "name color")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 })
      .lean();

    logger.info(`✅ Retrieved ${contents.length} content items`);

    res.status(200).json({
      success: true,
      data: {
        contents,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          currentPage: page,
          perPage: limit,
        },
      },
    });
  } catch (error) {
    logger.error(`Get contents error: ${error.message}`);
    next(error);
  }
};

/**
 * GET SINGLE CONTENT
 */
exports.getContent = async (req, res, next) => {
  try {
    const content = await Content.findOne({
      _id: req.params.id,
      user: req.user.id,
    }).populate("tags", "name color");

    if (!content) {
      return res.status(404).json({
        success: false,
        message: "Content not found",
      });
    }

    // Increment access count
    await content.incrementAccessCount();

    logger.info(`✅ Retrieved content: ${content.title}`);

    res.status(200).json({
      success: true,
      data: { content },
    });
  } catch (error) {
    logger.error(`Get content error: ${error.message}`);
    next(error);
  }
};

/**
 * UPDATE CONTENT
 */
exports.updateContent = async (req, res, next) => {
  try {
    const { title, description, isFavorite } = req.body;

    const content = await Content.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!content) {
      return res.status(404).json({
        success: false,
        message: "Content not found",
      });
    }

    // Update fields
    if (title) content.title = title;
    if (description !== undefined) content.description = description;
    if (isFavorite !== undefined) content.isFavorite = isFavorite;

    await content.save();

    logger.info(`✅ Content updated: ${content.title}`);

    res.status(200).json({
      success: true,
      data: { content },
    });
  } catch (error) {
    logger.error(`Update content error: ${error.message}`);
    next(error);
  }
};

/**
 * DELETE CONTENT
 */
exports.deleteContent = async (req, res, next) => {
  try {
    const content = await Content.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!content) {
      return res.status(404).json({
        success: false,
        message: "Content not found",
      });
    }

    // Delete file from Supabase if it exists
    if (content.fileKey) {
      try {
        await supabaseService.deleteFile(content.fileKey);
      } catch (deleteError) {
        logger.warn(
          `Failed to delete file from Supabase: ${deleteError.message}`
        );
      }
    }

    // Delete content document
    await content.deleteOne();

    logger.info(`✅ Content deleted: ${content.title}`);

    res.status(200).json({
      success: true,
      message: "Content deleted",
    });
  } catch (error) {
    logger.error(`Delete content error: ${error.message}`);
    next(error);
  }
};

/**
 * GET STATISTICS
 */
exports.getStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get stats by content type
    const statsByType = await Content.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: "$contentType",
          count: { $sum: 1 },
          totalSize: { $sum: "$metadata.fileSize" },
        },
      },
    ]);

    // Get total count
    const total = await Content.countDocuments({ user: userId });

    // Get most accessed
    const mostAccessed = await Content.find({ user: userId })
      .sort({ accessCount: -1 })
      .limit(5)
      .select("title accessCount");

    logger.info(`✅ Stats retrieved`);

    res.status(200).json({
      success: true,
      data: {
        total,
        byType: statsByType,
        mostAccessed,
      },
    });
  } catch (error) {
    logger.error(`Get stats error: ${error.message}`);
    next(error);
  }
};
