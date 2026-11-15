import { Router } from "express";
import { z } from "zod";
import Coupon from "../models/Coupon.js";
import Order from "../models/Order.js";
import { protect, adminOnly } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logAudit } from "../utils/auditLogger.js";

const router = Router();

const createSchema = z.object({
  code: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9_-]+$/),
  title: z.string().trim().min(3).max(100),
  description: z.string().max(300).optional(),
  type: z.enum(["percentage", "fixed"]),
  value: z.number().positive(),
  maxDiscount: z.number().min(0).nullable().optional(),
  minOrderAmount: z.number().min(0).default(0),
  visibility: z.enum(["public", "private"]).default("public"),
  eligibleEmails: z.array(z.string().email()).optional(),
  startsAt: z.string(),
  expiresAt: z.string(),
  usageLimit: z.number().int().positive().nullable().optional(),
  perUserLimit: z.number().int().positive().default(1),
  firstOrderOnly: z.boolean().default(false),
  isActive: z.boolean().default(true)
});

function calculateDiscount(coupon, subtotal) {
  let discount = coupon.type === "percentage" ? (subtotal * coupon.value) / 100 : coupon.value;
  if (coupon.maxDiscount != null) {
    discount = Math.min(discount, coupon.maxDiscount);
  }
  return Math.max(0, Math.min(Math.round(discount * 100) / 100, subtotal));
}

// 1. List active public coupons for customers
router.get("/public", asyncHandler(async (_req, res) => {
  const now = new Date();
  const coupons = await Coupon.find({
    visibility: "public",
    isActive: true,
    startsAt: { $lte: now },
    expiresAt: { $gte: now }
  })
    .select("code title description type value maxDiscount minOrderAmount expiresAt firstOrderOnly")
    .sort({ expiresAt: 1 });
  res.json({ coupons });
}));

// 2. Validate coupon during cart/checkout
router.post("/validate", protect, asyncHandler(async (req, res) => {
  const code = String(req.body.code || "").trim().toUpperCase();
  const subtotal = Number(req.body.subtotal);

  if (!code || !Number.isFinite(subtotal) || subtotal < 0) {
    return res.status(400).json({ valid: false, message: "Enter a coupon code and valid cart subtotal." });
  }

  const coupon = await Coupon.findOne({ code, isActive: true });
  const invalid = (message) => res.status(400).json({ valid: false, message });

  if (!coupon) return invalid("This coupon code does not exist or is inactive.");

  const now = new Date();
  if (now < coupon.startsAt) return invalid("This coupon is not active yet.");
  if (now > coupon.expiresAt) return invalid("This coupon has expired.");

  if (subtotal < coupon.minOrderAmount) {
    return invalid(`Minimum order amount for this coupon is ₹${coupon.minOrderAmount}.`);
  }

  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return invalid("This coupon has reached its total usage limit.");
  }

  if (
    coupon.visibility === "private" &&
    !coupon.eligibleUsers.some((id) => id.toString() === req.user._id.toString()) &&
    !coupon.eligibleEmails.includes(req.user.email.toLowerCase())
  ) {
    return invalid("This private coupon has not been assigned to your account.");
  }

  const userUses = await Order.countDocuments({
    user: req.user._id,
    "coupon.code": coupon.code,
    paymentStatus: "paid"
  });
  if (userUses >= coupon.perUserLimit) {
    return invalid("You have already used this coupon the maximum permitted times.");
  }

  if (coupon.firstOrderOnly) {
    const hasPaidOrder = await Order.exists({ user: req.user._id, paymentStatus: "paid" });
    if (hasPaidOrder) {
      return invalid("This coupon is valid for your first order only.");
    }
  }

  const discount = calculateDiscount(coupon, subtotal);
  res.json({
    valid: true,
    coupon: {
      code: coupon.code,
      title: coupon.title,
      type: coupon.type,
      value: coupon.value
    },
    discount,
    newSubtotal: Math.max(0, subtotal - discount),
    message: `Coupon applied! You save ₹${discount.toFixed(2)}.`
  });
}));

// 3. Admin list all coupons
router.get("/admin", protect, adminOnly, asyncHandler(async (_req, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 }).limit(300);
  res.json({ coupons });
}));

// 4. Admin create coupon
router.post("/", protect, adminOnly, asyncHandler(async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid coupon details.", errors: parsed.error.flatten() });
  }

  const data = parsed.data;
  const startsAt = new Date(data.startsAt);
  const expiresAt = new Date(data.expiresAt);

  if (isNaN(startsAt.getTime()) || isNaN(expiresAt.getTime())) {
    return res.status(400).json({ message: "Invalid start or expiry date." });
  }
  if (expiresAt <= startsAt) {
    return res.status(400).json({ message: "Expiry must be after the start date." });
  }
  if (data.type === "percentage" && data.value > 100) {
    return res.status(400).json({ message: "Percentage discount cannot exceed 100%." });
  }

  const code = data.code.toUpperCase();
  const existing = await Coupon.findOne({ code });
  if (existing) {
    return res.status(409).json({ message: `Coupon with code ${code} already exists.` });
  }

  const coupon = await Coupon.create({
    ...data,
    code,
    startsAt,
    expiresAt,
    eligibleEmails: (data.eligibleEmails || []).map((x) => x.toLowerCase())
  });

  await logAudit({
    action: "COUPON_CREATED",
    actor: req.user,
    targetType: "Coupon",
    targetId: coupon._id,
    details: { code: coupon.code, type: coupon.type, value: coupon.value },
    ip: req.ip
  });

  res.status(201).json({ coupon });
}));

// 5. Admin update coupon
router.patch("/:id", protect, adminOnly, asyncHandler(async (req, res) => {
  const allowed = {};
  for (const key of ["isActive", "title", "description", "expiresAt", "minOrderAmount", "usageLimit", "perUserLimit", "maxDiscount"]) {
    if (req.body[key] !== undefined) allowed[key] = req.body[key];
  }

  if (allowed.expiresAt) {
    allowed.expiresAt = new Date(allowed.expiresAt);
  }

  const coupon = await Coupon.findByIdAndUpdate(req.params.id, allowed, { new: true, runValidators: true });
  if (!coupon) return res.status(404).json({ message: "Coupon not found." });

  await logAudit({
    action: "COUPON_UPDATED",
    actor: req.user,
    targetType: "Coupon",
    targetId: coupon._id,
    details: allowed,
    ip: req.ip
  });

  res.json({ coupon });
}));

// 6. Admin delete coupon
router.delete("/:id", protect, adminOnly, asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) return res.status(404).json({ message: "Coupon not found." });

  await logAudit({
    action: "COUPON_DELETED",
    actor: req.user,
    targetType: "Coupon",
    targetId: coupon._id,
    details: { code: coupon.code },
    ip: req.ip
  });

  res.json({ message: "Coupon deleted successfully." });
}));

export default router;
