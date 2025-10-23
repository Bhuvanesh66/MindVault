const mongoose = require("mongoose");

/**
 * ========================================
 * TAG MODEL
 * ========================================
 *
 * User-created tags for organizing content
 *
 * Features:
 * - Tags are user-specific (same tag name can exist for different users)
 * - Automatic counting of associated content
 * - Color customization for UI
 * - Timestamps
 */

const TagSchema = new mongoose.Schema(
  {
    // Tag name (e.g., "javascript", "machine-learning")
    name: {
      type: String,
      required: [true, "Please provide a tag name"],
      trim: true,
      lowercase: true, // Store in lowercase for consistency
      maxlength: [50, "Tag name cannot exceed 50 characters"],
    },

    // Reference to user who owns this tag
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },

    // Color for displaying tag in UI (hex code)
    color: {
      type: String,
      default: "#3b82f6", // Default blue
      match: [/^#[0-9A-F]{6}$/i, "Please provide a valid hex color code"],
    },

    // How many content items have this tag
    count: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Tag description (optional)
    description: {
      type: String,
      maxlength: [200, "Description cannot exceed 200 characters"],
      default: "",
    },

    // Tag icon (optional - emoji or icon name)
    icon: {
      type: String,
      default: "",
    },

    // Whether this is a system tag (auto-created)
    isSystem: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * INDEXES for performance
 */

// Ensure tag name is unique per user
TagSchema.index({ user: 1, name: 1 }, { unique: true });

// Index for quick tag lookups by user
TagSchema.index({ user: 1 });

// Index for sorting by count
TagSchema.index({ count: -1 });

/**
 * METHOD: Increment count when content is tagged
 */
TagSchema.methods.incrementCount = async function () {
  this.count += 1;
  return this.save();
};

/**
 * METHOD: Decrement count when content is untagged
 */
TagSchema.methods.decrementCount = async function () {
  if (this.count > 0) {
    this.count -= 1;
  }
  return this.save();
};

/**
 * STATIC METHOD: Get user's tags sorted by usage
 */
TagSchema.statics.getUserTags = async function (userId) {
  return await this.find({ user: userId }).sort({ count: -1 }).lean();
};

/**
 * STATIC METHOD: Get popular tags for user
 */
TagSchema.statics.getPopularTags = async function (userId, limit = 10) {
  return await this.find({ user: userId, count: { $gt: 0 } })
    .sort({ count: -1 })
    .limit(limit)
    .lean();
};

/**
 * STATIC METHOD: Create or get tag
 */
TagSchema.statics.createOrGet = async function (
  name,
  userId,
  color = "#3b82f6"
) {
  const tagName = name.toLowerCase().trim();

  // Try to find existing tag
  let tag = await this.findOne({ name: tagName, user: userId });

  // Create if doesn't exist
  if (!tag) {
    tag = await this.create({
      name: tagName,
      user: userId,
      color: color,
    });
  }

  return tag;
};

module.exports = mongoose.model("Tag", TagSchema);
