import { Router } from "express";
import User from "../models/User.js";
import Order from "../models/Order.js";
import Reservation from "../models/Reservation.js";
import MenuItem from "../models/MenuItem.js";
import Coupon from "../models/Coupon.js";
import AuditLog from "../models/AuditLog.js";
import { protect, adminOnly } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// Protect all reporting endpoints for Admin
router.use(protect, adminOnly);

// 1. Executive KPIs and operational overview
router.get("/overview", asyncHandler(async (_req, res) => {
  const [
    totalUsers,
    activeStaff,
    totalOrders,
    orderStatusCounts,
    revenueAgg,
    totalReservations,
    reservationStatusCounts,
    totalMenuItems,
    activeCoupons
  ] = await Promise.all([
    User.countDocuments({ role: "customer" }),
    User.countDocuments({ role: "staff", status: "active" }),
    Order.countDocuments(),
    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: null, totalRevenue: { $sum: "$total" }, paidOrdersCount: { $sum: 1 } } }
    ]),
    Reservation.countDocuments(),
    Reservation.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    MenuItem.countDocuments({ isAvailable: true }),
    Coupon.countDocuments({ isActive: true })
  ]);

  const salesTotal = revenueAgg.length > 0 ? revenueAgg[0].totalRevenue : 0;
  const paidOrders = revenueAgg.length > 0 ? revenueAgg[0].paidOrdersCount : 0;

  const ordersByStatus = {};
  for (const item of orderStatusCounts) {
    ordersByStatus[item._id] = item.count;
  }

  const reservationsByStatus = {};
  for (const item of reservationStatusCounts) {
    reservationsByStatus[item._id] = item.count;
  }

  res.json({
    kpis: {
      totalCustomers: totalUsers,
      activeStaff,
      totalOrders,
      paidOrders,
      totalRevenue: Math.round(salesTotal * 100) / 100,
      totalReservations,
      activeMenuItems: totalMenuItems,
      activeCoupons
    },
    ordersByStatus,
    reservationsByStatus
  });
}));

// 2. Audit logs query
router.get("/audit-logs", asyncHandler(async (req, res) => {
  const { action, targetType, limit = 50, page = 1 } = req.query;
  const filter = {};
  if (action) filter.action = action;
  if (targetType) filter.targetType = targetType;

  const pageNum = Math.max(1, Number(page));
  const pageSize = Math.min(100, Math.max(1, Number(limit)));

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize),
    AuditLog.countDocuments(filter)
  ]);

  res.json({ logs, total, page: pageNum, pages: Math.ceil(total / pageSize) });
}));

export default router;
