import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function protect(req, res, next) {
  try {
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null;
    if (!token) return res.status(401).json({ message: "Please sign in first." });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: "Account not found." });

    if (user.status === "blocked") {
      return res.status(403).json({ message: "Account has been suspended. Please contact administrator." });
    }

    if (user.status === "pending" && user.role === "staff") {
      return res.status(403).json({ message: "Staff account is awaiting administrator approval." });
    }
    
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired session." });
  }
}

export function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
}

export function staffOrAdmin(req, res, next) {
  if (!["staff", "admin"].includes(req.user?.role)) {
    return res.status(403).json({ message: "Staff or admin access required." });
  }
  next();
}
