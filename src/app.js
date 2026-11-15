import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth.js";
import menuRoutes from "./routes/menu.js";
import orderRoutes from "./routes/orders.js";
import reservationRoutes from "./routes/reservations.js";
import couponRoutes from "./routes/coupons.js";
import userRoutes from "./routes/users.js";
import reviewRoutes from "./routes/reviews.js";
import reportRoutes from "./routes/reports.js";

const app = express();

// Secure headers
app.use(helmet());

// CORS configuration
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((s) => s.trim())
  : ["http://localhost:5173", "http://127.0.0.1:5173"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      return callback(new Error("CORS policy violation: Origin not allowed."));
    },
    credentials: true
  })
);

// Body parsing with rawBody preserved for Razorpay webhook signature verification
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Rate limiting (skip in test environment)
const isTest = process.env.NODE_ENV === "test";
if (!isTest) {
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests. Please try again later." }
  });
  app.use("/api", apiLimiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many authentication attempts. Please try again after 15 minutes." }
  });
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
}

// Health check endpoint
app.get("/api/health", (_req, res) =>
  res.json({
    status: "ok",
    service: "TasteTrail API",
    timestamp: new Date().toISOString()
  })
);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/reports", reportRoutes);

// 404 handler for unknown routes
app.use((req, res) =>
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` })
);

// Centralized error handler
app.use((err, _req, res, _next) => {
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({ message: `A record with that ${field} already exists.` });
  }

  if (err?.name === "ValidationError") {
    return res.status(400).json({ message: err.message });
  }

  if (err?.name === "CastError") {
    return res.status(400).json({ message: "Invalid resource identifier." });
  }

  console.error("Unhandled API Error:", err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message:
      process.env.NODE_ENV === "production" && status === 500
        ? "Internal server error."
        : err.message || "Internal server error."
  });
});

export default app;
