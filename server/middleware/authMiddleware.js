const jwt = require("jsonwebtoken");
const User = require("../models/User");
const logger = require("../utils/logger");

/**
 * ========================================
 * AUTHENTICATION MIDDLEWARE
 * ========================================
 *
 * This middleware:
 * 1. Verifies JWT tokens
 * 2. Checks if user is active
 * 3. Attaches user data to request
 *
 * Usage in routes:
 * router.get('/profile', protect, getProfile);
 *
 * How JWT works:
 * Client sends: Authorization: Bearer TOKEN
 * Middleware verifies and decodes token
 * Extracts user ID and fetches user from DB
 */

/**
 * PROTECT: Verify JWT and check authentication
 */
const protect = async (req, res, next) => {
  let token;

  try {
    // Check if Authorization header exists
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      // Extract token from "Bearer TOKEN" format
      // Split by space and get the second part
      token = req.headers.authorization.split(" ")[1];
    }

    // If no token found
    if (!token) {
      logger.warn("No token provided");
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route - no token provided",
      });
    }

    try {
      // Verify token signature and expiration
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from database using ID from token
      // Don't include password in result
      req.user = await User.findById(decoded.id).select("-password");

      // Check if user exists
      if (!req.user) {
        logger.warn(`User not found for ID: ${decoded.id}`);
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if user account is active
      if (!req.user.isActive) {
        logger.warn(`Inactive user tried to access: ${req.user.email}`);
        return res.status(401).json({
          success: false,
          message: "Your account has been deactivated",
        });
      }

      // Update last login timestamp
      req.user.lastLogin = new Date();
      await req.user.save();

      // Log successful authentication
      logger.info(`✅ User authenticated: ${req.user.email}`);

      // Continue to next middleware/controller
      next();
    } catch (error) {
      // Token verification failed
      if (error.name === "TokenExpiredError") {
        logger.warn("Token expired");
        return res.status(401).json({
          success: false,
          message: "Token has expired. Please login again.",
        });
      }

      if (error.name === "JsonWebTokenError") {
        logger.warn("Invalid token");
        return res.status(401).json({
          success: false,
          message: "Invalid token. Please login again.",
        });
      }

      throw error;
    }
  } catch (error) {
    logger.error(`Auth error: ${error.message}`);
    return res.status(401).json({
      success: false,
      message: "Not authorized to access this route",
    });
  }
};

/**
 * ADMIN: Check if user is admin
 * Use after protect middleware
 *
 * Usage:
 * router.delete('/user/:id', protect, admin, deleteUser);
 */
const admin = (req, res, next) => {
  try {
    // Check if user exists and has admin role
    if (req.user && req.user.role === "admin") {
      logger.info(`Admin user accessed: ${req.user.email}`);
      next(); // Continue if admin
    } else {
      logger.warn(`Non-admin user tried admin action: ${req.user?.email}`);
      return res.status(403).json({
        success: false,
        message: "This route is only available to administrators",
      });
    }
  } catch (error) {
    logger.error(`Admin check error: ${error.message}`);
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }
};

/**
 * OPTIONAL AUTH: Doesn't fail if no token
 * Used for features that work with or without login
 */
const optionalAuth = async (req, res, next) => {
  let token;

  try {
    // Check for token
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // If token exists, verify it
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select("-password");

        if (req.user && req.user.isActive) {
          logger.info(`Optional auth: User authenticated: ${req.user.email}`);
        }
      } catch (error) {
        logger.warn(
          `Optional auth token verification failed: ${error.message}`
        );
        // Don't fail - user is just not authenticated
      }
    }

    // Continue regardless of auth status
    next();
  } catch (error) {
    logger.error(`Optional auth error: ${error.message}`);
    next(); // Continue even on error
  }
};

module.exports = { protect, admin, optionalAuth };
