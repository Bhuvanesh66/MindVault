const { createClient } = require("@supabase/supabase-js");
const logger = require("../utils/logger");

/**
 * ========================================
 * Supabase Client Configuration
 * ========================================
 *
 * This file creates a Supabase client for file storage.
 * Supabase replaces AWS S3 for MindVault - it's FREE!
 *
 * Features:
 * - 1GB free storage (enough for ~1000 documents)
 * - Private file access
 * - Signed URLs for temporary access
 * - Row-level security
 *
 * Storage Bucket: "mindvault-files"
 * Access Level: Private (only authenticated users)
 */

let supabase;

try {
  // Validate environment variables
  if (!process.env.SUPABASE_URL) {
    throw new Error("SUPABASE_URL is not defined in .env");
  }

  if (!process.env.SUPABASE_KEY) {
    throw new Error("SUPABASE_KEY is not defined in .env");
  }

  // Initialize Supabase client
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
    // Configuration options
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },

    // Realtime configuration
    realtime: {
      broadcast: { self: true },
      presence: { key: "users" },
    },

    // Global fetch options
    global: {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    },
  });

  console.log("✅ Supabase Client Initialized");
  console.log(`   🌍 URL: ${process.env.SUPABASE_URL}`);
  console.log(`   💾 Storage Bucket: mindvault-files`);
  logger.info("✅ Supabase client initialized");
} catch (error) {
  console.error("❌ Supabase Configuration Error!");
  console.error(`   📋 Error: ${error.message}`);
  console.error(`   💡 Make sure SUPABASE_URL and SUPABASE_KEY are in .env\n`);

  logger.error(`❌ Supabase Error: ${error.message}`);

  // Don't exit - Supabase is optional for some operations
  // but we should alert the developer
}

/**
 * Helper function to upload files to Supabase
 * (This is often imported in services/supabaseService.js)
 */
const uploadToSupabase = async (fileBuffer, filePath) => {
  try {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const { data, error } = await supabase.storage
      .from("mindvault-files")
      .upload(filePath, fileBuffer, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    logger.info(`✅ File uploaded to Supabase: ${filePath}`);
    return { success: true, data };
  } catch (error) {
    logger.error(`❌ Supabase upload error: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Helper function to get public URL
 */
const getPublicUrl = (filePath) => {
  if (!supabase) {
    throw new Error("Supabase not initialized");
  }

  const { data } = supabase.storage
    .from("mindvault-files")
    .getPublicUrl(filePath);

  return data.publicUrl;
};

/**
 * Helper function to delete files
 */
const deleteFromSupabase = async (filePath) => {
  try {
    if (!supabase) {
      throw new Error("Supabase not initialized");
    }

    const { error } = await supabase.storage
      .from("mindvault-files")
      .remove([filePath]);

    if (error) throw error;

    logger.info(`✅ File deleted from Supabase: ${filePath}`);
    return { success: true };
  } catch (error) {
    logger.error(`❌ Supabase delete error: ${error.message}`);
    return { success: false, error: error.message };
  }
};

// Export client and helper functions
module.exports = {
  supabase,
  uploadToSupabase,
  getPublicUrl,
  deleteFromSupabase,
};
