const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

/**
 * ========================================
 * USER MODEL
 * ========================================
 *
 * Stores user account information:
 * - Authentication (email, password)
 * - Profile (name, role)
 * - Status (active/inactive)
 *
 * Features:
 * - Automatic password hashing (bcrypt)
 * - Password matching for login
 * - Email uniqueness enforcement
 * - Timestamps (created, updated)
 */

const UserSchema = new mongoose.Schema(
  {
    // User's full name
    name: {
      type: String,
      required: [true, "Please provide a name"],
      trim: true,
      maxlength: [50, "Name cannot exceed 50 characters"],
    },

    // User's email (unique - used for login)
    email: {
      type: String,
      required: [true, "Please provide an email"],
      unique: true, // No two users can have same email
      lowercase: true, // Convert to lowercase for consistency
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },

    // User's password (will be hashed automatically)
    password: {
      type: String,
      required: [true, "Please provide a password"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't return password in queries by default
    },

    // User role (for admin features)
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    // Account status
    isActive: {
      type: Boolean,
      default: true,
    },

    // User profile picture (optional)
    profilePicture: {
      type: String,
      default: null,
    },

    // User bio (optional)
    bio: {
      type: String,
      maxlength: [500, "Bio cannot exceed 500 characters"],
      default: "",
    },

    // Subscription type (free, premium, etc)
    subscriptionType: {
      type: String,
      enum: ["free", "premium", "enterprise"],
      default: "free",
    },

    // Total storage used (in bytes)
    storageUsed: {
      type: Number,
      default: 0,
    },

    // Maximum storage allowed based on subscription
    storageLimit: {
      type: Number,
      default: 1 * 1024 * 1024 * 1024, // 1GB default
    },

    // Last login timestamp
    lastLogin: {
      type: Date,
      default: null,
    },

    // Two-factor authentication enabled
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },

    // User preferences
    preferences: {
      theme: {
        type: String,
        enum: ["light", "dark", "auto"],
        default: "auto",
      },
      language: {
        type: String,
        default: "en",
      },
      notifications: {
        type: Boolean,
        default: true,
      },
      emailNotifications: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt
  }
);

/**
 * MIDDLEWARE: Hash password before saving
 * Runs automatically before user.save()
 */
UserSchema.pre("save", async function (next) {
  // Only hash if password is new or modified
  if (!this.isModified("password")) {
    return next();
  }

  try {
    // Generate salt for hashing
    const salt = await bcrypt.genSalt(10);

    // Hash the password
    this.password = await bcrypt.hash(this.password, salt);

    next();
  } catch (error) {
    next(error);
  }
});

/**
 * METHOD: Compare entered password with stored hashed password
 * Used during login: const isMatch = await user.matchPassword(enteredPassword)
 */
UserSchema.methods.matchPassword = async function (enteredPassword) {
  try {
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (error) {
    throw new Error("Password comparison failed");
  }
};

/**
 * METHOD: Get user public profile (without password)
 */
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password; // Remove password from response
  delete obj.__v; // Remove version field
  return obj;
};

/**
 * STATIC METHOD: Find user by email
 */
UserSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

/**
 * INDEX: Speed up email lookups
 */
UserSchema.index({ email: 1 });
UserSchema.index({ createdAt: -1 });

module.exports = mongoose.model("User", UserSchema);
