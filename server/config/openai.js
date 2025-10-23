const OpenAI = require("openai");
const logger = require("../utils/logger");

/**
 * ========================================
 * OpenAI API Configuration
 * ========================================
 *
 * This file initializes the OpenAI client for:
 * 1. Text Embeddings - Convert text to vectors (1536 dimensions)
 * 2. Chat Completions - AI summaries and responses
 * 3. Whisper API - Audio/video transcription (not used in config, but available)
 *
 * Cost:
 * - Embeddings: ~$0.02 per 1M tokens
 * - GPT-3.5-turbo: ~$0.50 per 1M input tokens
 * - Whisper: ~$0.006 per minute of audio
 *
 * Free Credits: $5 for new accounts (enough for ~250,000 embeddings)
 *
 * Models Available:
 * - text-embedding-3-small: 1536 dimensions (used for MindVault)
 * - gpt-3.5-turbo: Fast and cost-effective
 * - gpt-4: More powerful (higher cost)
 * - whisper-1: Audio transcription
 */

let openai;

try {
  // Validate API key
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not defined in .env");
  }

  if (!process.env.OPENAI_API_KEY.startsWith("sk-")) {
    throw new Error(
      'OPENAI_API_KEY does not start with "sk-" - check your key'
    );
  }

  // Initialize OpenAI client
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,

    // Optional configuration
    timeout: 20 * 1000, // 20 second timeout
    maxRetries: 2, // Retry failed requests up to 2 times
  });

  console.log("✅ OpenAI Client Initialized");
  console.log(`   🤖 Models Available: embeddings, chat-completion, whisper`);
  console.log(`   💰 Embeddings Model: text-embedding-3-small (1536 dims)`);
  console.log(`   💰 Chat Model: gpt-3.5-turbo`);
  logger.info("✅ OpenAI client initialized");
} catch (error) {
  console.error("❌ OpenAI Configuration Error!");
  console.error(`   📋 Error: ${error.message}`);
  console.error(
    `   💡 Get your API key from: https://platform.openai.com/api-keys`
  );
  console.error(
    `   💡 Make sure OPENAI_API_KEY is in .env and starts with "sk-"\n`
  );

  logger.error(`❌ OpenAI Error: ${error.message}`);

  // Don't exit - but log the error prominently
  // Some features will fail, but app can still run
}

/**
 * Test function to verify OpenAI connection
 * (Can be called from server startup)
 */
const testOpenAIConnection = async () => {
  try {
    if (!openai) {
      throw new Error("OpenAI client not initialized");
    }

    // Simple test - create a small embedding
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: "test",
    });

    if (response.data && response.data.length > 0) {
      console.log("✅ OpenAI API connection verified");
      logger.info("✅ OpenAI API connection verified");
      return true;
    }
  } catch (error) {
    console.error("❌ OpenAI API connection failed!");
    console.error(`   Error: ${error.message}`);
    logger.error(`❌ OpenAI connection test failed: ${error.message}`);
    return false;
  }
};

/**
 * Create embeddings for text
 * Used for semantic search in MindVault
 */
const createEmbedding = async (text) => {
  try {
    if (!openai) {
      throw new Error("OpenAI client not initialized");
    }

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small", // 1536 dimensions
      input: text.slice(0, 8000), // Truncate to token limit
      encoding_format: "float",
    });

    if (response.data && response.data[0]) {
      logger.info(
        `✅ Embedding created: ${response.data[0].embedding.length} dimensions`
      );
      return response.data[0].embedding;
    }
  } catch (error) {
    logger.error(`❌ Embedding creation failed: ${error.message}`);
    throw error;
  }
};

/**
 * Create text summary using GPT
 * Used for auto-summarizing content
 */
const createSummary = async (text) => {
  try {
    if (!openai) {
      throw new Error("OpenAI client not initialized");
    }

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that creates concise summaries of content.",
        },
        {
          role: "user",
          content: `Please summarize the following content in 2-3 sentences:\n\n${text.slice(
            0,
            500
          )}`,
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    if (response.choices && response.choices[0]) {
      const summary = response.choices[0].message.content.trim();
      logger.info(`✅ Summary created: ${summary.length} characters`);
      return summary;
    }
  } catch (error) {
    logger.error(`❌ Summary creation failed: ${error.message}`);
    throw error;
  }
};

/**
 * Transcribe audio using Whisper API
 */
const transcribeAudio = async (audioBuffer, audioFormat = "mp3") => {
  try {
    if (!openai) {
      throw new Error("OpenAI client not initialized");
    }

    const response = await openai.audio.transcriptions.create({
      file: audioBuffer,
      model: "whisper-1",
      language: "en",
      response_format: "text",
    });

    logger.info(`✅ Audio transcribed: ${response.length} characters`);
    return response;
  } catch (error) {
    logger.error(`❌ Transcription failed: ${error.message}`);
    throw error;
  }
};

// Export client and helper functions
module.exports = {
  openai,
  testOpenAIConnection,
  createEmbedding,
  createSummary,
  transcribeAudio,
};
