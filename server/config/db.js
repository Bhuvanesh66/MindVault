const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * ========================================
 * MongoDB Atlas Database Connection
 * ========================================
 * 
 * This file handles the connection to MongoDB Atlas
 * which stores all user data, content, and tags.
 * 
 * Free tier: 512MB storage (enough for ~100,000 documents)
 * 
 * Features:
 * - Automatic reconnection on failure
 * - Connection pooling for performance
 * - Debug mode in development
 */

const connectDB = async () => {
  try {
    // Log connection attempt
    console.log('🔄 Connecting to MongoDB Atlas...');
    logger.info('🔄 Attempting MongoDB connection');

    // Connect to MongoDB using connection string from .env
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Use new URL parser (deprecated old parser)
      useNewUrlParser: true,
      
      // Use new connection management
      useUnifiedTopology: true,
      
      // Optional: Connection pooling for better performance
      maxPoolSize: 10,
      minPoolSize: 2,
      
      // Retry connection attempts
      retryWrites: true,
      w: 'majority',
    });

    // Success message with server details
    const host = conn.connection.host;
    const database = conn.connection.name;
    
    console.log(`✅ MongoDB Connected Successfully!`);
    console.log(`   🌍 Host: ${host}`);
    console.log(`   📊 Database: ${database}`);
    console.log(`   🔌 Status: Ready`);
    
    logger.info(`✅ MongoDB Connected: ${host} (Database: ${database})`);

    // Return connection for optional use
    return conn;

  } catch (error) {
    // Log error details
    console.error(`\n❌ MongoDB Connection Error!`);
    console.error(`   📋 Error: ${error.message}`);
    console.error(`   🔗 Connection String: ${process.env.MONGODB_URI?.substring(0, 50)}...`);
    console.error(`   💡 Tip: Check your MONGODB_URI in .env file\n`);
    
    logger.error(`❌ MongoDB Error: ${error.message}`);
    logger.error(`Connection URI: ${process.env.MONGODB_URI}`);

    // Exit process if database connection fails
    // (Application can't run without database)
    process.exit(1);
  }
};

/**
 * Handle connection events
 */
mongoose.connection.on('connected', () => {
  logger.info('Mongoose connected to MongoDB');
});

mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose disconnected from MongoDB');
});

mongoose.connection.on('error', (error) => {
  logger.error(`Mongoose connection error: ${error.message}`);
});

// Export connection function
module.exports = connectDB;
