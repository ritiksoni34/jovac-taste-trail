import { Router } from "express";
import { z } from "zod"; 
import User from "../models/User.js";
import { protect, adminOnly } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logAudit } from "../utils/auditLogger.js";

const router = Router();

// Protect all user management routes for Admin
router.use(protect, adminOnly);

// 1. List users with filtering, search, and pagination
router.get("/", asyncHandler(async (req, res) => {
  const { role, status, search, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (role && ["customer", "staff", "admin"].includes(role)) {
    filter.role = role;
  }
  if (status && ["active", "pending", "blocked"].includes(status)) {
    filter.status = status;
  }
  if (search) {
    const q = String(search).trim().slice(0, 50);
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } }
    ];
  }

  const skip = (Math.max(1, Number(page)) - 1) * Math.min(100, Math.max(1, Number(limit)));
  const pageSize = Math.min(100, Math.max(1, Number(limit)));

  const [users, total] = await Promise.all([
    User.find(filter)
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize),
    User.countDocuments(filter)
  ]);

  res.json({
    users,
    total,
    page: Number(page),
    pages: Math.ceil(total / pageSize)
  });
}));

// 2. Pending staff applications
router.get("/staff-requests", asyncHandler(async (_req, res) => {
  const requests = await User.find({ role: "staff", status: "pending" })
    .select("-passwordHash")
    .sort({ createdAt: -1 });
  res.json({ requests });
}));

// 3. Update user status (approve, block, activate)
router.patch("/:id/status", asyncHandler(async (req, res) => {
  const schema = z.object({
    status: z.enum(["active", "pending", "blocked"])
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid status. Must be active, pending, or blocked." });
  }

  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ message: "User not found." });

  // Prevent admin from blocking themselves
  if (target._id.toString() === req.user._id.toString()) {
    return res.status(400).json({ message: "You cannot change your own status." });
  }

  const oldStatus = target.status;
  target.status = parsed.data.status;
  await target.save();

  await logAudit({
    action: target.role === "staff" && oldStatus === "pending" && target.status === "active"
      ? "STAFF_APPROVED"
      : "USER_STATUS_UPDATED",
    actor: req.user,
    targetType: "User",
    targetId: target._id,
    details: { oldStatus, newStatus: target.status, email: target.email, role: target.role },
    ip: req.ip
  });

  res.json({
    message: `User status updated to ${target.status}.`,
    user: {
      id: target._id,
      name: target.name,
      email: target.email,
      role: target.role,
      status: target.status
    }
  });
}));

// 4. Update user role (promote to staff, demote to customer)
router.patch("/:id/role", asyncHandler(async (req, res) => {
  const schema = z.object({
    role: z.enum(["customer", "staff", "admin"])
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid role." });
  }

  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ message: "User not found." });

  // Prevent demoting self or removing the last admin
  if (target._id.toString() === req.user._id.toString() && parsed.data.role !== "admin") {
    return res.status(400).json({ message: "You cannot change your own administrative role." });
  }

  if (target.role === "admin" && parsed.data.role !== "admin") {
    const adminCount = await User.countDocuments({ role: "admin" });
    if (adminCount <= 1) {
      return res.status(400).json({ message: "Cannot remove the only remaining administrator." });
    }
  }

  const oldRole = target.role;
  target.role = parsed.data.role;
  // If promoted to staff or admin, ensure status is active
  if (target.role !== "customer" && target.status === "pending") {
    target.status = "active";
  }
  await target.save();

  await logAudit({
    action: "USER_ROLE_CHANGED",
    actor: req.user,
    targetType: "User",
    targetId: target._id,
    details: { oldRole, newRole: target.role, email: target.email },
    ip: req.ip
  });

  res.json({
    message: `User role updated to ${target.role}.`,
    user: {
      id: target._id,
      name: target.name,
      email: target.email,
      role: target.role,
      status: target.status
    }
  });
}));

export default router;
