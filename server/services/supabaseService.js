const { supabase, uploadToSupabase, getPublicUrl, deleteFromSupabase } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * ========================================
 * SUPABASE FILE STORAGE SERVICE
 * ========================================
 * 
 * Handles all file operations with Supabase:
 * - Upload files (images, videos, audio, PDFs)
 * - Get download links
 * - Delete files
 * - Manage storage
 * 
 * Replaces AWS S3 - completely FREE!
 */

class SupabaseService {
  /**
   * Upload file to Supabase Storage
   * @param {Buffer} fileBuffer - File content as bytes
   * @param {string} fileName - Original filename
   * @param {string} userId - User ID for folder structure
   * @param {string} contentType - File MIME type
   * @returns {Promise<Object>} - { url, path, size }
   */
  async uploadFile(fileBuffer, fileName, userId, contentType = 'application/octet-stream') {
    try {
      // Validate inputs
      if (!fileBuffer) throw new Error('File buffer is required');
      if (!fileName) throw new Error('File name is required');
      if (!userId) throw new Error('User ID is required');

      // Log upload attempt
      const fileSizeKB = (fileBuffer.length / 1024).toFixed(2);
      logger.info(`📤 Uploading file: ${fileName} (${fileSizeKB}KB)`);

      // Create unique file path: userId/timestamp-filename
      // Example: 507f1f77bcf86cd799439011/1698234567890-document.pdf
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const filePath = `${userId}/${timestamp}-${randomStr}-${fileName}`;

      // Upload to Supabase Storage bucket
      const { data, error } = await supabase.storage
        .from('mindvault-files')
        .upload(filePath, fileBuffer, {
          cacheControl: '3600', // Cache for 1 hour
          upsert: false, // Don't overwrite existing files
          contentType: contentType,
        });

      // Check for upload errors
      if (error) {
        logger.error(`❌ Supabase upload error: ${error.message}`);
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL for the file
      const { data: publicUrlData } = supabase.storage
        .from('mindvault-files')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      logger.info(`✅ File uploaded successfully: ${publicUrl}`);

      return {
        success: true,
        url: publicUrl,
        path: filePath,
        size: fileBuffer.length,
        fileName: fileName,
        uploadedAt: new Date().toISOString(),
      };

    } catch (error) {
      logger.error(`❌ Upload service error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get signed URL for temporary file access
   * @param {string} filePath - File path in storage
   * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
   * @returns {Promise<string>} - Signed URL
   */
  async getSignedUrl(filePath, expiresIn = 3600) {
    try {
      if (!filePath) throw new Error('File path is required');

      logger.info(`🔗 Generating signed URL for: ${filePath}`);

      // Create signed URL with expiration
      const { data, error } = await supabase.storage
        .from('mindvault-files')
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        throw new Error(`Signed URL failed: ${error.message}`);
      }

      logger.info(`✅ Signed URL generated (expires in ${expiresIn}s)`);

      return {
        success: true,
        url: data.signedUrl,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      };

    } catch (error) {
      logger.error(`❌ Signed URL error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete file from Supabase Storage
   * @param {string} filePath - File path in storage
   * @returns {Promise<void>}
   */
  async deleteFile(filePath) {
    try {
      if (!filePath) throw new Error('File path is required');

      logger.info(`🗑️  Deleting file: ${filePath}`);

      // Delete from Supabase
      const { error } = await supabase.storage
        .from('mindvault-files')
        .remove([filePath]);

      if (error) {
        throw new Error(`Delete failed: ${error.message}`);
      }

      logger.info(`✅ File deleted: ${filePath}`);

      return {
        success: true,
        deletedPath: filePath,
        deletedAt: new Date().toISOString(),
      };

    } catch (error) {
      logger.error(`❌ Delete error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if file exists in Supabase
   * @param {string} filePath - File path in storage
   * @returns {Promise<boolean>}
   */
  async fileExists(filePath) {
    try {
      const { data, error } = await supabase.storage
        .from('mindvault-files')
        .list(filePath.substring(0, filePath.lastIndexOf('/')));

      if (error) return false;

      const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
      return data.some((file) => file.name === fileName);

    } catch (error) {
      logger.error(`❌ File exists check error: ${error.message}`);
      return false;
    }
  }

  /**
   * Get file info (size, type, etc)
   * @param {string} filePath - File path in storage
   * @returns {Promise<Object>} - File metadata
   */
  async getFileInfo(filePath) {
    try {
      if (!filePath) throw new Error('File path is required');

      logger.info(`📋 Getting file info: ${filePath}`);

      const { data, error } = await supabase.storage
        .from('mindvault-files')
        .list(filePath.substring(0, filePath.lastIndexOf('/')));

      if (error) throw error;

      const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
      const fileInfo = data.find((file) => file.name === fileName);

      if (!fileInfo) {
        throw new Error('File not found');
      }

      return {
        success: true,
        name: fileInfo.name,
        size: fileInfo.metadata?.size || 0,
        createdAt: fileInfo.created_at,
        updatedAt: fileInfo.updated_at,
      };

    } catch (error) {
      logger.error(`❌ File info error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Copy file in storage
   * @param {string} sourcePath - Source file path
   * @param {string} destPath - Destination file path
   * @returns {Promise<Object>}
   */
  async copyFile(sourcePath, destPath) {
    try {
      if (!sourcePath || !destPath) throw new Error('Source and destination paths are required');

      logger.info(`📋 Copying file from ${sourcePath} to ${destPath}`);

      // Download source file
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('mindvault-files')
        .download(sourcePath);

      if (downloadError) throw downloadError;

      // Upload to destination
      const { error: uploadError } = await supabase.storage
        .from('mindvault-files')
        .upload(destPath, fileData);

      if (uploadError) throw uploadError;

      logger.info(`✅ File copied successfully`);

      return {
        success: true,
        sourcePath,
        destPath,
      };

    } catch (error) {
      logger.error(`❌ Copy file error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new SupabaseService();