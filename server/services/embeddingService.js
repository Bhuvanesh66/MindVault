const { openai, createEmbedding } = require("../config/openai");
const logger = require("../utils/logger");

/**
 * ========================================
 * EMBEDDING SERVICE
 * ========================================
 *
 * Converts text into vector embeddings using OpenAI
 * Embeddings are used for semantic search
 *
 * Model: text-embedding-3-small
 * Dimensions: 1536
 * Cost: ~$0.02 per 1M tokens
 */

class EmbeddingService {
  /**
   * Generate embedding for a single text
   * @param {string} text - Text to embed
   * @returns {Promise<Array>} - Vector with 1536 dimensions
   */
  async generateEmbedding(text) {
    try {
      // Validate input
      if (!text || typeof text !== "string") {
        throw new Error("Text must be a non-empty string");
      }

      const originalLength = text.length;
      logger.info(`🔄 Generating embedding for text (${originalLength} chars)`);

      // Truncate if too long (max ~8000 chars safely)
      const truncatedText = text.slice(0, 8000);

      // Call OpenAI to generate embedding
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small", // Fast and efficient
        input: truncatedText,
        encoding_format: "float",
      });

      // Extract embedding vector
      if (!response.data || !response.data[0]) {
        throw new Error("No embedding data returned from OpenAI");
      }

      const embedding = response.data[0].embedding;

      logger.info(`✅ Embedding generated: ${embedding.length} dimensions`);

      return {
        success: true,
        embedding: embedding,
        dimensions: embedding.length,
        inputLength: truncatedText.length,
        tokens: Math.ceil(truncatedText.length / 4), // Approximate token count
      };
    } catch (error) {
      logger.error(`❌ Embedding error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts
   * @param {Array<string>} texts - Array of texts to embed
   * @returns {Promise<Array>} - Array of embeddings
   */
  async generateBatchEmbeddings(texts) {
    try {
      if (!Array.isArray(texts) || texts.length === 0) {
        throw new Error("Texts must be a non-empty array");
      }

      logger.info(`🔄 Generating embeddings for ${texts.length} texts`);

      // Generate embeddings sequentially
      const embeddings = await Promise.all(
        texts.map(async (text) => {
          try {
            const result = await this.generateEmbedding(text);
            return result.embedding;
          } catch (error) {
            logger.warn(`Failed to embed one text: ${error.message}`);
            return null;
          }
        })
      );

      logger.info(
        `✅ Batch embeddings completed: ${embeddings.filter(Boolean).length}/${
          texts.length
        }`
      );

      return {
        success: true,
        embeddings: embeddings,
        total: texts.length,
        successful: embeddings.filter(Boolean).length,
      };
    } catch (error) {
      logger.error(`❌ Batch embedding error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate comprehensive embedding from content
   * Combines title, description, text, summary for better representation
   * @param {Object} content - Content object with title, description, originalText, summary
   * @returns {Promise<Array>} - Embedding vector
   */
  async generateContentEmbedding(content) {
    try {
      if (!content) throw new Error("Content object is required");

      logger.info(`🔄 Generating content embedding`);

      // Collect all text from content
      const textParts = [
        content.title || "", // Title (most important)
        content.description || "", // Description
        content.originalText || "", // Extracted text from file
        content.summary || "", // AI-generated summary
        (content.autoTags || []).join(" "), // Auto-generated tags
      ].filter(Boolean); // Remove empty strings

      // Combine all parts
      const combinedText = textParts.join(" ").trim();

      if (combinedText.length === 0) {
        logger.warn("⚠️  No text content available for embedding");
        return {
          success: false,
          embedding: [],
          warning: "No text content",
        };
      }

      // Generate embedding
      const result = await this.generateEmbedding(combinedText);

      logger.info(`✅ Content embedding generated`);

      return {
        ...result,
        contentLength: combinedText.length,
        parts: textParts.length,
      };
    } catch (error) {
      logger.error(`❌ Content embedding error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate similarity between two embeddings
   * @param {Array} embedding1 - First embedding vector
   * @param {Array} embedding2 - Second embedding vector
   * @returns {number} - Similarity score (0-1)
   */
  cosineSimilarity(embedding1, embedding2) {
    try {
      if (!embedding1 || !embedding2) return 0;
      if (embedding1.length !== embedding2.length) return 0;

      // Calculate dot product
      let dotProduct = 0;
      let norm1 = 0;
      let norm2 = 0;

      for (let i = 0; i < embedding1.length; i++) {
        dotProduct += embedding1[i] * embedding2[i];
        norm1 += embedding1[i] * embedding1[i];
        norm2 += embedding2[i] * embedding2[i];
      }

      // Calculate cosine similarity
      const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);

      if (denominator === 0) return 0;

      const similarity = dotProduct / denominator;

      // Normalize to 0-1 range
      return (similarity + 1) / 2;
    } catch (error) {
      logger.error(`❌ Similarity calculation error: ${error.message}`);
      return 0;
    }
  }

  /**
   * Find most similar embedding from a batch
   * @param {Array} queryEmbedding - Query vector
   * @param {Array<Array>} embeddings - Array of embedding vectors
   * @param {number} topK - Return top K results
   * @returns {Array} - Top K similar embeddings with scores
   */
  findMostSimilar(queryEmbedding, embeddings, topK = 5) {
    try {
      if (!queryEmbedding || !embeddings) return [];

      // Calculate similarities
      const similarities = embeddings.map((emb, index) => ({
        index,
        similarity: this.cosineSimilarity(queryEmbedding, emb),
      }));

      // Sort by similarity and return top K
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK)
        .map((item) => ({
          index: item.index,
          similarity: Math.round(item.similarity * 100) / 100, // Round to 2 decimals
        }));
    } catch (error) {
      logger.error(`❌ Find similar error: ${error.message}`);
      return [];
    }
  }
}

module.exports = new EmbeddingService();
