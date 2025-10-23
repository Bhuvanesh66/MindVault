const logger = require("../utils/logger");

/**
 * ========================================
 * ERROR HANDLER MIDDLEWARE
 * ========================================
 *
 * This middleware catches ALL errors
 * and returns formatted error responses
 *
 * MUST be the LAST middleware in server.js
 *
 * Usage in server.js:
 * app.use(errorHandler);
 */

const errorHandler = (err, req, res, next) => {
  // Log error details
  logger.error(`
    ========================================
    ERROR OCCURRED
    ========================================
    Path: ${req.path}
    Method: ${req.method}
    Message: ${err.message}
    Stack: ${err.stack}
    ========================================
  `);

  // Create error object with defaults
  let error = { ...err };
  error.message = err.message;
  error.statusCode = error.statusCode || 500;

  // ============================================
  // Handle specific error types
  // ============================================

  // 1. MONGOOSE CAST ERROR (invalid ID format)
  if (err.name === "CastError") {
    const message = `Resource not found with id: ${err.value}`;
    error.message = message;
    error.statusCode = 404;
    logger.error(`CastError: ${message}`);
  }

  // 2. MONGOOSE DUPLICATE KEY ERROR
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `A record with ${field} "${value}" already exists`;
    error.message = message;
    error.statusCode = 400;
    logger.error(`DuplicateKeyError: ${message}`);
  }

  // 3. MONGOOSE VALIDATION ERROR
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
    error.message = message;
    error.statusCode = 400;
    logger.error(`ValidationError: ${message}`);
  }

  // 4. JWT ERRORS
  if (err.name === "JsonWebTokenError") {
    const message = "Invalid token";
    error.message = message;
    error.statusCode = 401;
    logger.error(`JsonWebTokenError: ${message}`);
  }

  // 5. JWT EXPIRED ERROR
  if (err.name === "TokenExpiredError") {
    const message = "Token expired";
    error.message = message;
    error.statusCode = 401;
    logger.error(`TokenExpiredError: ${message}`);
  }

  // 6. MULTER ERRORS
  if (err.name === "MulterError") {
    let message = "File upload error";

    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File too large. Maximum size is 100MB";
    } else if (err.code === "LIMIT_FILE_COUNT") {
      message = "Too many files";
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      message = "Unexpected file field";
    }

    error.message = message;
    error.statusCode = 400;
    logger.error(`MulterError: ${message}`);
  }

  // 7. SYNTAX ERROR (JSON parsing)
  if (err instanceof SyntaxError && "body" in err) {
    const message = "Invalid JSON in request body";
    error.message = message;
    error.statusCode = 400;
    logger.error(`SyntaxError: ${message}`);
  }

  // 8. CUSTOM ERRORS (from controllers)
  if (err.name === "AppError") {
    error.message = err.message;
    error.statusCode = err.statusCode || 500;
    logger.error(`AppError: ${err.message}`);
  }

  // ============================================
  // Send error response
  // ============================================

  res.status(error.statusCode).json({
    success: false,
    message: error.message || "An error occurred",

    // Include error code in development
    ...(process.env.NODE_ENV === "development" && {
      error: {
        name: err.name,
        statusCode: error.statusCode,
        stack: err.stack,
        details: err,
      },
    }),
  });
};

/**
 * ASYNC ERROR WRAPPER
 * Wraps async controller functions to catch errors
 *
 * Usage:
 * const catchAsync = require('./catchAsync');
 * router.get('/content', catchAsync(getContent));
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * CUSTOM APP ERROR CLASS
 * Create custom errors easily
 *
 * Usage:
 * throw new AppError('User not found', 404);
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { errorHandler, catchAsync, AppError };
