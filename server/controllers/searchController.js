const embeddingService = require("../services/embeddingService");
const vectorSearchService = require("../services/vectorSearchService");
const Content = require("../models/Content");
const logger = require("../utils/logger");

/**
 * SEMANTIC SEARCH: Search by meaning
 */
exports.semanticSearch = async (req, res, next) => {
  try {
    const { query, limit = 10 } = req.body;
    const userId = req.user.id;

    if (!query || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    logger.info(`🔍 Semantic search: "${query}"`);

    // Generate embedding for query
    const embeddingResult = await embeddingService.generateEmbedding(query);

    if (!embeddingResult.success) {
      throw new Error("Failed to generate query embedding");
    }

    // Search using embedding
    const searchResult = await vectorSearchService.vectorSearch(
      embeddingResult.embedding,
      userId,
      parseInt(limit)
    );

    logger.info(`✅ Semantic search: ${searchResult.results.length} results`);

    res.status(200).json({
      success: true,
      data: {
        query,
        results: searchResult.results,
        total: searchResult.totalMatches,
      },
    });
  } catch (error) {
    logger.error(`Semantic search error: ${error.message}`);
    next(error);
  }
};

/**
 * TEXT SEARCH: Traditional keyword search
 */
exports.textSearch = async (req, res, next) => {
  try {
    const { q, limit = 20 } = req.query;
    const userId = req.user.id;

    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search query required",
      });
    }

    logger.info(`🔍 Text search: "${q}"`);

    const results = await Content.find(
      {
        user: userId,
        $text: { $search: q },
      },
      { score: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(parseInt(limit))
      .select("title description contentType fileUrl summary")
      .lean();

    logger.info(`✅ Text search: ${results.length} results`);

    res.status(200).json({
      success: true,
      data: { query: q, results },
    });
  } catch (error) {
    logger.error(`Text search error: ${error.message}`);
    next(error);
  }
};

/**
 * FIND SIMILAR CONTENT
 */
exports.findSimilar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = 5 } = req.query;

    logger.info(`🔍 Finding similar to: ${id}`);

    const similarResult = await vectorSearchService.findSimilarContent(
      id,
      parseInt(limit)
    );

    if (!similarResult.success) {
      return res.status(404).json({
        success: false,
        message: "Content not found or has no embedding",
      });
    }

    logger.info(`✅ Found ${similarResult.similarItems.length} similar items`);

    res.status(200).json({
      success: true,
      data: {
        originalContent: id,
        results: similarResult.similarItems,
      },
    });
  } catch (error) {
    logger.error(`Find similar error: ${error.message}`);
    next(error);
  }
};

/**
 * HYBRID SEARCH: Combine vector + text search
 */
exports.hybridSearch = async (req, res, next) => {
  try {
    const { query, limit = 10 } = req.body;
    const userId = req.user.id;

    if (!query || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    logger.info(`🔍 Hybrid search: "${query}"`);

    const result = await vectorSearchService.hybridSearch(
      query,
      userId,
      parseInt(limit)
    );

    logger.info(
      `✅ Hybrid search: ${result.vectorResults} vector + ${result.textResults} text`
    );

    res.status(200).json({
      success: true,
      data: {
        query,
        vectorResults: result.vectorResults,
        textResults: result.textResults,
        results: result.results,
      },
    });
  } catch (error) {
    logger.error(`Hybrid search error: ${error.message}`);
    next(error);
  }
};
