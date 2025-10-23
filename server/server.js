require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const {errorHandler} = require("./middleware/errorHandler");
const logger = require("./utils/logger");
const ocrService = require("./services/ocrService");

// Connect to database
connectDB();

const app = express();

// MIDDLEWARE
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ROUTES

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/content", require("./routes/contentRoutes"));
app.use("/api/search", require("./routes/searchRoutes"));
app.use('/api/ai', require('./routes/aiRoutes'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path,
  });
});

// Error handler (MUST be last)
app.use(errorHandler);

// START SERVER
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, async () => {
  logger.info(`
    ========================================
    🚀 MindVault Server Started!
    ========================================
    Port: ${PORT}
    Environment: ${process.env.NODE_ENV}
    ✅ Database: Connected
    ✅ Supabase: Configured
    ✅ OpenAI: Configured
    ✅ OCR: Ready
    ========================================
  `);

  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`🧪 Test: curl http://localhost:${PORT}/health\n`);
});

// Handle server errors
server.on("error", (error) => {
  logger.error(`Server error: ${error.message}`);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down gracefully...");

  // Cleanup OCR service
  await ocrService.terminate();

  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down...");

  await ocrService.terminate();

  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (error) => {
  logger.error(`Unhandled rejection: ${error.message}`);
  server.close(() => process.exit(1));
});

module.exports = app;
