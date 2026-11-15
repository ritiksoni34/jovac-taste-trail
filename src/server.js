import "dotenv/config";
import app from "./app.js";
import { connectDB, disconnectDB } from "./config/db.js";

const port = Number(process.env.PORT || 5000);

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be configured with at least 32 characters.");
  process.exit(1);
}

let server;

try {
  await connectDB();
  server = app.listen(port, () => {
    console.log(`TasteTrail API running at http://localhost:${port}`);
  });
} catch (error) {
  console.error("Startup failed:", error.message);
  process.exit(1);
}

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Shutting down TasteTrail server gracefully...`);
  if (server) {
    server.close(async () => {
      console.log("HTTP server closed.");
      await disconnectDB();
      process.exit(0);
    });
  } else {
    await disconnectDB();
    process.exit(0);
  }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
