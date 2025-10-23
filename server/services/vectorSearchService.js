const Content = require("../models/Content");
const embeddingService = require("./embeddingService");
const logger = require("../utils/logger");

/**
 * ========================================
 * VECTOR SEARCH SERVICE
 * ========================================
 *
 * Finds similar content using vector embeddings
 * Performs semantic search
 *
 * Uses MongoDB vector similarity search
 */

class VectorSearchService {
  /**
   * Search for similar content using embedding
   * @param {Array} queryEmbedding - Query vector (1536 dims)
   * @param {string} userId - User ID for filtering
   * @param {number} limit - Max results to return
   * @returns {Promise<Array>} - Similar content items
   */
  async vectorSearch(queryEmbedding, userId, limit = 10) {
    try {
      if (!queryEmbedding || queryEmbedding.length !== 1536) {
        throw new Error("Query embedding must be 1536 dimensions");
      }

      logger.info(`🔍 Vector search for user: ${userId}, limit: ${limit}`);

      // Get all user's content
      const allContent = await Content.find({ user: userId })
        .populate("tags", "name color")
        .lean();

      // Calculate similarity for each content item
      const scored = allContent
        .map((item) => ({
          ...item,
          similarity: embeddingService.cosineSimilarity(
            queryEmbedding,
            item.embedding || []
          ),
        }))
        .filter((item) => item.embedding && item.embedding.length > 0);

      // Sort by similarity and limit results
      const results = scored
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      logger.info(`✅ Vector search returned ${results.length} results`);

      return {
        success: true,
        results: results,
        totalMatches: scored.length,
        topMatches: results.length,
      };
    } catch (error) {
      logger.error(`❌ Vector search error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find content similar to a specific item
   * @param {string} contentId - Content ID to find similar items for
   * @param {number} limit - Max results
   * @returns {Promise<Array>} - Similar content
   */
  async findSimilarContent(contentId, limit = 5) {
    try {
      logger.info(`🔍 Finding similar content to: ${contentId}`);

      // Get the content item with embedding
      const content = await Content.findById(contentId).select(
        "embedding user"
      );

      if (!content) {
        throw new Error("Content not found");
      }

      if (!content.embedding || content.embedding.length === 0) {
        throw new Error("Content has no embedding");
      }

      // Search for similar content
      const searchResult = await this.vectorSearch(
        content.embedding,
        content.user.toString(),
        limit + 1 // Get one extra to exclude original
      );

      // Filter out the original content
      const similar = searchResult.results.filter(
        (item) => item._id.toString() !== contentId
      );

      logger.info(`✅ Found ${similar.length} similar items`);

      return {
        success: true,
        originalContent: contentId,
        similarItems: similar,
        totalMatches: searchResult.totalMatches,
      };
    } catch (error) {
      logger.error(`❌ Find similar error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Semantic search with query text
   * 1. Convert query to embedding
   * 2. Find similar content
   * @param {string} query - Search query text
   * @param {string} userId - User ID
   * @param {number} limit - Max results
   * @returns {Promise<Array>} - Search results
   */
  async semanticSearch(query, userId, limit = 10) {
    try {
      logger.info(`🔍 Semantic search: "${query.substring(0, 50)}..."`);

      // Generate embedding for query
      const embeddingResult = await embeddingService.generateEmbedding(query);

      if (!embeddingResult.success) {
        throw new Error("Failed to generate query embedding");
      }

      // Search using embedding
      const searchResult = await this.vectorSearch(
        embeddingResult.embedding,
        userId,
        limit
      );

      logger.info(
        `✅ Semantic search completed: ${searchResult.results.length} results`
      );

      return {
        success: true,
        query: query,
        results: searchResult.results,
        queryEmbedding: embeddingResult.embedding.slice(0, 5), // First 5 dimensions only
      };
    } catch (error) {
      logger.error(`❌ Semantic search error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Hybrid search: Combine vector search with text search
   * Best of both worlds!
   * @param {string} query - Search query
   * @param {string} userId - User ID
   * @param {number} limit - Max results
   * @returns {Promise<Array>} - Hybrid search results
   */
  async hybridSearch(query, userId, limit = 10) {
    try {
      logger.info(`🔍 Hybrid search: "${query}"`);

      // 1. Vector search
      const vectorResult = await this.semanticSearch(query, userId, limit);

      // 2. Text search (MongoDB)
      const textResults = await Content.find(
        {
          user: userId,
          $text: { $search: query },
        },
        { score: { $meta: "textScore" } }
      )
        .sort({ score: { $meta: "textScore" } })
        .limit(limit)
        .lean();

      // 3. Merge results (vector results first, then text-only)
      const vectorIds = new Set(
        vectorResult.results.map((r) => r._id.toString())
      );

      const textOnlyResults = textResults.filter(
        (r) => !vectorIds.has(r._id.toString())
      );

      const mergedResults = [...vectorResult.results, ...textOnlyResults].slice(
        0,
        limit
      );

      logger.info(
        `✅ Hybrid search: ${vectorResult.results.length} vector + ${textOnlyResults.length} text`
      );

      return {
        success: true,
        query: query,
        vectorResults: vectorResult.results.length,
        textResults: textOnlyResults.length,
        results: mergedResults,
      };
    } catch (error) {
      logger.error(`❌ Hybrid search error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search by tags
   * @param {Array<string>} tagIds - Array of tag IDs
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Content with these tags
   */
  async searchByTags(tagIds, userId) {
    try {
      logger.info(`🏷️  Searching by ${tagIds.length} tags`);

      const content = await Content.find({
        user: userId,
        tags: { $in: tagIds },
      })
        .populate("tags", "name color")
        .sort({ createdAt: -1 })
        .lean();

      logger.info(`✅ Found ${content.length} items with these tags`);

      return {
        success: true,
        tags: tagIds,
        items: content,
        total: content.length,
      };
    } catch (error) {
      logger.error(`❌ Tag search error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Trending searches (most accessed similar items)
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Popular content clusters
   */
  async getTrendingSearches(userId) {
    try {
      logger.info(`📊 Getting trending searches for user`);

      // Get most accessed content
      const trendingContent = await Content.find({ user: userId })
        .sort({ accessCount: -1 })
        .limit(10)
        .lean();

      logger.info(`✅ Found ${trendingContent.length} trending items`);

      return {
        success: true,
        trending: trendingContent,
        total: trendingContent.length,
      };
    } catch (error) {
      logger.error(`❌ Trending search error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new VectorSearchService();
