import mongoose from "mongoose";

const connectDB = async () => {
    try {
        if (!process.env.dbUrl) {
            throw new Error('Database URL is not defined in environment variables');
        }

        await mongoose.connect(process.env.dbUrl);
        
        console.log("✅ Database connected successfully");
    } catch (error) {
        console.error("❌ Database connection failed:", error.message);
        // Re-throw the error so it can be handled by the calling function
        throw error;
    }
};

export { connectDB };