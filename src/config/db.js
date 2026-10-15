import mongoose from "mongoose";

let isConnecting = false;

export async function connectDB(uriOverride = null) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const primaryUri = uriOverride || process.env.MONGODB_URI;
  const localFallbackUri = process.env.LOCAL_MONGODB_URI || "mongodb://127.0.0.1:27017/tastetrail";

  if (!primaryUri && !localFallbackUri) {
    throw new Error("MONGODB_URI is missing");
  }

  // Setup lifecycle listeners once
  if (!mongoose.connection.listeners("disconnected").length) {
    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB connection lost. Reconnecting...");
    });
    mongoose.connection.on("error", (err) => {
      console.error("MongoDB error event:", err.message);
    });
  }

  try {
    console.log("Connecting to primary MongoDB cluster...");
    await mongoose.connect(primaryUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
    return mongoose.connection;
  } catch (error) {
    console.warn(`Primary MongoDB connection failed: ${error.message}`);
    // If running in development/test and primary failed (e.g. Atlas IP whitelist block), try local MongoDB
    if (process.env.NODE_ENV !== "production" && primaryUri !== localFallbackUri) {
      console.log(`Attempting fallback connection to local MongoDB (${localFallbackUri})...`);
      try {
        await mongoose.connect(localFallbackUri, {
          serverSelectionTimeoutMS: 4000,
        });
        console.log(`Connected to fallback local MongoDB: ${mongoose.connection.host}`);
        return mongoose.connection;
      } catch (fallbackError) {
        console.error("Local MongoDB fallback also failed:", fallbackError.message);
      }
    }
    throw error;
  }
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log("MongoDB disconnected cleanly.");
  }
}

