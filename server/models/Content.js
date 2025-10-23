const mongoose = require("mongoose");

/**
 * ========================================
 * CONTENT MODEL
 * ========================================
 *
 * Stores all user content:
 * - Articles, links, notes
 * - Images, videos, audio
 * - PDFs and documents
 *
 * Features:
 * - Vector embeddings for semantic search
 * - Extracted text (OCR/transcription)
 * - AI-generated summaries
 * - Tags and auto-tags
 * - User ownership tracking
 * - Access statistics
 */

const ContentSchema = new mongoose.Schema(
  {
    // Reference to the user who owns this content
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true, // Speed up user lookups
    },

    // Content title
    title: {
      type: String,
      required: [true, "Please provide a title"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
      index: true, // Index for text search
    },

    // Content description
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
      default: "",
    },

    // Type of content
    contentType: {
      type: String,
      enum: {
        values: ["article", "image", "video", "pdf", "audio", "note", "link"],
        message: "Invalid content type",
      },
      required: [true, "Content type is required"],
      index: true,
    },

    // URL to file stored in Supabase
    fileUrl: {
      type: String,
      default: null,
    },

    // Original file path in Supabase (for deletion)
    fileKey: {
      type: String,
      default: null,
    },

    // Extracted text from images (OCR) or audio/video (transcription)
    originalText: {
      type: String,
      default: "",
    },

    // AI-generated summary of the content
    summary: {
      type: String,
      default: "",
      maxlength: [500, "Summary cannot exceed 500 characters"],
    },

    // Vector embedding for semantic search (1536 dimensions from OpenAI)
    embedding: {
      type: [Number],
      default: [],
    },

    // User-created tags (references to Tag documents)
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tag",
      },
    ],

    // Auto-generated tags from AI
    autoTags: {
      type: [String],
      default: [],
    },

    // Additional metadata
    metadata: {
      fileSize: Number, // in bytes
      mimeType: String, // e.g., 'image/jpeg', 'video/mp4'
      duration: Number, // for audio/video in seconds
      language: String, // detected language
      width: Number, // for images/videos
      height: Number, // for images/videos
      pages: Number, // for PDFs
    },

    // User preferences
    isFavorite: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Whether content is archived
    isArchived: {
      type: Boolean,
      default: false,
    },

    // How many times user accessed this content
    accessCount: {
      type: Number,
      default: 0,
    },

    // When content was last accessed
    lastAccessedAt: {
      type: Date,
      default: null,
    },

    // Content visibility (private, shared, public)
    visibility: {
      type: String,
      enum: ["private", "shared", "public"],
      default: "private",
    },

    // Shared with users (if visibility is 'shared')
    sharedWith: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Processing status
    processingStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "completed",
    },

    // Error message if processing failed
    processingError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt and updatedAt
  }
);

/**
 * INDEXES for performance
 */

// Index for user content queries
ContentSchema.index({ user: 1, contentType: 1 });
ContentSchema.index({ user: 1, isFavorite: 1 });
ContentSchema.index({ user: 1, createdAt: -1 });

// Text index for keyword search
ContentSchema.index({
  title: "text",
  description: "text",
  originalText: "text",
  summary: "text",
  autoTags: "text",
});

// Compound index for filtering and sorting
ContentSchema.index({ user: 1, visibility: 1, createdAt: -1 });

/**
 * MIDDLEWARE: Update user storage used
 */
ContentSchema.post("save", async function (doc) {
  // Update user's storage used after saving content
  if (doc.metadata?.fileSize) {
    const User = mongoose.model("User");
    await User.findByIdAndUpdate(
      doc.user,
      { $inc: { storageUsed: doc.metadata.fileSize } },
      { new: true }
    );
  }
});

/**
 * MIDDLEWARE: Update user storage used on deletion
 */
ContentSchema.post("deleteOne", { document: true }, async function (doc) {
  // Subtract from user's storage used
  if (doc.metadata?.fileSize) {
    const User = mongoose.model("User");
    await User.findByIdAndUpdate(
      doc.user,
      { $inc: { storageUsed: -doc.metadata.fileSize } },
      { new: true }
    );
  }
});

/**
 * METHOD: Get content with populated tags
 */
ContentSchema.methods.populateTags = async function () {
  return await this.populate("tags", "name color");
};

/**
 * METHOD: Increment access count
 */
ContentSchema.methods.incrementAccessCount = async function () {
  this.accessCount += 1;
  this.lastAccessedAt = new Date();
  return this.save();
};

/**
 * STATIC METHOD: Get user's statistics
 */
ContentSchema.statics.getUserStats = async function (userId) {
  const stats = await this.aggregate([
    { $match: { user: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: "$contentType",
        count: { $sum: 1 },
        totalSize: { $sum: "$metadata.fileSize" },
      },
    },
  ]);

  return stats;
};

/**
 * STATIC METHOD: Get user's recent content
 */
ContentSchema.statics.getRecentContent = async function (userId, limit = 10) {
  return await this.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("tags", "name color");
};

module.exports = mongoose.model("Content", ContentSchema);
