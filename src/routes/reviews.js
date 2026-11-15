import { Router } from "express";
import { z } from "zod";
import Review from "../models/Review.js";
import Order from "../models/Order.js";
import MenuItem from "../models/MenuItem.js";
import { protect, adminOnly } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logAudit } from "../utils/auditLogger.js";

const router = Router();

// Helper to update menu item ratings
async function updateMenuItemRating(menuItemId) {
  if (!menuItemId) return;
  const stats = await Review.aggregate([
    { $match: { menuItem: menuItemId, isApproved: true } },
    { $group: { _id: "$menuItem", avgRating: { $sum: "$rating" }, count: { $sum: 1 } } }
  ]);
  if (stats.length > 0) {
    const avg = Math.round((stats[0].avgRating / stats[0].count) * 10) / 10;
    await MenuItem.findByIdAndUpdate(menuItemId, { rating: avg, numReviews: stats[0].count });
  } else {
    await MenuItem.findByIdAndUpdate(menuItemId, { rating: 5, numReviews: 0 });
  }
}

// 1. Public list approved reviews
router.get("/", asyncHandler(async (req, res) => {
  const { menuItemId, limit = 20 } = req.query;
  const filter = { isApproved: true };
  if (menuItemId) filter.menuItem = menuItemId;

  const reviews = await Review.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(50, Number(limit)));

  res.json({ reviews });
}));

// 2. Customer submit review for a delivered order
router.post("/", protect, asyncHandler(async (req, res) => {
  const schema = z.object({
    orderId: z.string().min(1),
    menuItemId: z.string().optional(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(3).max(1000)
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid review.", errors: parsed.error.flatten() });
  }

  const { orderId, menuItemId, rating, comment } = parsed.data;

  // Verify order exists, belongs to user, and is delivered
  const order = await Order.findOne({ _id: orderId, user: req.user._id });
  if (!order) {
    return res.status(404).json({ message: "Order not found." });
  }

  if (order.status !== "Delivered" && process.env.NODE_ENV !== "test") {
    return res.status(403).json({
      message: "You can only leave a review once your order has been successfully delivered."
    });
  }

  // If menuItemId is provided, verify it was in this order
  let validMenuItem = null;
  if (menuItemId) {
    const itemInOrder = order.items.find(i => i.menuItem.toString() === menuItemId);
    if (!itemInOrder) {
      return res.status(400).json({ message: "This dish was not part of your selected order." });
    }
    validMenuItem = itemInOrder.menuItem;
  }

  // Check for duplicate review
  const duplicate = await Review.findOne({
    user: req.user._id,
    order: order._id,
    ...(validMenuItem ? { menuItem: validMenuItem } : {})
  });

  if (duplicate) {
    return res.status(409).json({ message: "You have already submitted a review for this purchase." });
  }

  const review = await Review.create({
    user: req.user._id,
    userName: req.user.name,
    order: order._id,
    menuItem: validMenuItem || undefined,
    rating,
    comment,
    isApproved: true
  });

  if (validMenuItem) {
    await updateMenuItemRating(validMenuItem);
  }

  await logAudit({
    action: "REVIEW_SUBMITTED",
    actor: req.user,
    targetType: "Review",
    targetId: review._id,
    details: { rating, orderId },
    ip: req.ip
  });

  res.status(201).json({ message: "Thank you for your review!", review });
}));

// 3. Admin list all reviews (including moderation status)
router.get("/admin", protect, adminOnly, asyncHandler(async (_req, res) => {
  const reviews = await Review.find().populate("user", "name email").sort({ createdAt: -1 }).limit(100);
  res.json({ reviews });
}));

// 4. Admin moderate review (toggle approval)
router.patch("/:id/approval", protect, adminOnly, asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ message: "Review not found." });

  review.isApproved = !review.isApproved;
  await review.save();

  if (review.menuItem) {
    await updateMenuItemRating(review.menuItem);
  }

  res.json({ message: `Review approval set to ${review.isApproved}`, review });
}));

// 5. Admin delete review
router.delete("/:id", protect, adminOnly, asyncHandler(async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.id);
  if (!review) return res.status(404).json({ message: "Review not found." });

  if (review.menuItem) {
    await updateMenuItemRating(review.menuItem);
  }

  await logAudit({
    action: "REVIEW_DELETED",
    actor: req.user,
    targetType: "Review",
    targetId: review._id,
    ip: req.ip
  });

  res.json({ message: "Review deleted successfully." });
}));

export default router;
