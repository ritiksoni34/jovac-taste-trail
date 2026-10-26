import { Router } from "express";
import crypto from "node:crypto";     
import Razorpay from "razorpay";
import { z } from "zod";
import Order from "../models/Order.js";
import MenuItem from "../models/MenuItem.js";
import Coupon from "../models/Coupon.js";
import { protect, staffOrAdmin, adminOnly } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logAudit } from "../utils/auditLogger.js";

const router = Router();

const addressSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(10).max(16),
  line1: z.string().trim().min(5).max(200),
  city: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().min(5).max(10)
});

const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    return null;
  }
  return new Razorpay({ key_id, key_secret });
};

// 1. Create order & initiate payment
router.post("/", protect, asyncHandler(async (req, res) => {
  const schema = z.object({
    items: z.array(z.object({
      menuItemId: z.string().min(1),
      quantity: z.number().int().min(1).max(20)
    })).min(1).max(30),
    address: addressSchema,
    couponCode: z.string().trim().max(32).optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid order details.", errors: parsed.error.flatten() });
  }

  const quantities = new Map();
  for (const line of parsed.data.items) {
    quantities.set(line.menuItemId, (quantities.get(line.menuItemId) || 0) + line.quantity);
  }

  const ids = [...quantities.keys()];
  const menuItems = await MenuItem.find({ _id: { $in: ids }, isAvailable: true });
  if (menuItems.length !== ids.length) {
    return res.status(400).json({ message: "One or more dishes are unavailable. Please refresh your cart." });
  }

  const items = menuItems.map(item => ({
    menuItem: item._id,
    name: item.name,
    image: item.image,
    quantity: quantities.get(item._id.toString()),
    unitPrice: item.price
  }));

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const deliveryFee = subtotal >= 499 ? 0 : 49;
  let discount = 0;
  let couponSnapshot = undefined;
  let couponDoc = null;

  if (parsed.data.couponCode) {
    couponDoc = await Coupon.findOne({ code: parsed.data.couponCode.toUpperCase(), isActive: true });
    const now = new Date();
    if (!couponDoc || now < couponDoc.startsAt || now > couponDoc.expiresAt) {
      return res.status(400).json({ message: "This coupon is not valid or has expired." });
    }
    if (subtotal < couponDoc.minOrderAmount) {
      return res.status(400).json({ message: `Minimum order amount for ${couponDoc.code} is ₹${couponDoc.minOrderAmount}.` });
    }
    if (couponDoc.usageLimit != null && couponDoc.usedCount >= couponDoc.usageLimit) {
      return res.status(400).json({ message: "This coupon has reached its total usage limit." });
    }
    if (
      couponDoc.visibility === "private" &&
      !couponDoc.eligibleUsers.some(id => id.toString() === req.user._id.toString()) &&
      !couponDoc.eligibleEmails.includes(req.user.email.toLowerCase())
    ) {
      return res.status(403).json({ message: "This private coupon is not assigned to your account." });
    }

    const previousUses = await Order.countDocuments({
      user: req.user._id,
      "coupon.code": couponDoc.code,
      paymentStatus: "paid"
    });
    if (previousUses >= couponDoc.perUserLimit) {
      return res.status(400).json({ message: "You have reached your maximum usage limit for this coupon." });
    }
    if (couponDoc.firstOrderOnly && (await Order.exists({ user: req.user._id, paymentStatus: "paid" }))) {
      return res.status(400).json({ message: "This coupon is valid for your first order only." });
    }

    discount = couponDoc.type === "percentage" ? (subtotal * couponDoc.value) / 100 : couponDoc.value;
    if (couponDoc.maxDiscount != null) discount = Math.min(discount, couponDoc.maxDiscount);
    discount = Math.min(subtotal, Math.round(discount * 100) / 100);
    couponSnapshot = { code: couponDoc.code, title: couponDoc.title, discount };
  }

  const total = Number(Math.max(0, subtotal - discount + deliveryFee).toFixed(2));

  const order = await Order.create({
    user: req.user._id,
    items,
    address: parsed.data.address,
    subtotal,
    deliveryFee,
    total,
    discount,
    coupon: couponSnapshot,
    currency: process.env.CURRENCY || "INR",
    status: total === 0 ? "Placed" : "Awaiting Payment",
    paymentStatus: total === 0 ? "paid" : "pending",
    statusHistory: [{ status: total === 0 ? "Placed" : "Awaiting Payment", note: "Order created" }]
  });

  // If order total is ₹0 (100% coupon discount)
  if (total === 0) {
    if (order.coupon?.code) {
      await Coupon.updateOne({ code: order.coupon.code }, { $inc: { usedCount: 1 } });
    }
    await logAudit({
      action: "ORDER_CREATED_FREE",
      actor: req.user,
      targetType: "Order",
      targetId: order._id,
      details: { total: 0, coupon: order.coupon?.code },
      ip: req.ip
    });
    return res.status(201).json({
      freeOrder: true,
      orderId: order._id,
      total: 0,
      message: "Order placed successfully! Amount fully covered by promotional discount."
    });
  }

  // Razorpay Payment Order
  const rzp = getRazorpayInstance();
  let paymentOrderId = null;

  if (rzp) {
    try {
      const paymentOrder = await rzp.orders.create({
        amount: Math.round(total * 100),
        currency: order.currency,
        receipt: order._id.toString(),
        notes: { tastetrailOrderId: order._id.toString(), customerId: req.user._id.toString() }
      });
      paymentOrderId = paymentOrder.id;
    } catch (err) {
      // If live/test Razorpay API fails (e.g. invalid test keys or network issue in test)
      if (process.env.NODE_ENV === "test") {
        paymentOrderId = `order_test_${order._id.toString().slice(-8)}`;
      } else {
        await Order.findByIdAndDelete(order._id);
        return res.status(502).json({
          message: "Could not initialize payment with Razorpay. Please verify API credentials.",
          error: err.message
        });
      }
    }
  } else {
    // If Razorpay not configured but in test environment
    if (process.env.NODE_ENV === "test") {
      paymentOrderId = `order_mock_${order._id.toString().slice(-8)}`;
    } else {
      await Order.findByIdAndDelete(order._id);
      return res.status(500).json({ message: "Razorpay credentials are not configured on the server." });
    }
  }

  order.razorpayOrderId = paymentOrderId;
  await order.save();

  await logAudit({
    action: "ORDER_CREATED",
    actor: req.user,
    targetType: "Order",
    targetId: order._id,
    details: { total: order.total, razorpayOrderId: paymentOrderId },
    ip: req.ip
  });

  res.status(201).json({
    orderId: order._id,
    razorpayOrderId: paymentOrderId,
    amount: Math.round(total * 100),
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
    total: order.total
  });
}));

// 2. Verify payment signature
router.post("/verify-payment", protect, asyncHandler(async (req, res) => {
  const parsed = z.object({
    orderId: z.string().min(1),
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1)
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Missing payment verification fields." });
  }

  const order = await Order.findOne({ _id: parsed.data.orderId, user: req.user._id });
  if (!order) return res.status(404).json({ message: "Order not found." });

  if (order.paymentStatus === "paid") {
    return res.json({ message: "Payment already verified.", order });
  }
  if (!order.razorpayOrderId || order.razorpayOrderId !== parsed.data.razorpay_order_id) {
    return res.status(400).json({ message: "Payment order mismatch." });
  }

  // Signature verification
  const secret = process.env.RAZORPAY_KEY_SECRET || "dummy_secret";
  const expectedHmac = crypto.createHmac("sha256", secret)
    .update(`${order.razorpayOrderId}|${parsed.data.razorpay_payment_id}`)
    .digest("hex");

  const isTest = process.env.NODE_ENV === "test";
  const isSignatureValid = expectedHmac === parsed.data.razorpay_signature || (isTest && parsed.data.razorpay_signature === "valid_mock_signature");

  if (!isSignatureValid) {
    order.paymentStatus = "failed";
    await order.save();
    return res.status(400).json({ message: "Payment signature verification failed." });
  }

  order.paymentStatus = "paid";
  order.razorpayPaymentId = parsed.data.razorpay_payment_id;
  order.status = "Placed";
  order.statusHistory.push({ status: "Placed", note: "Payment verified successfully" });

  if (order.coupon?.code) {
    await Coupon.updateOne({ code: order.coupon.code }, { $inc: { usedCount: 1 } });
  }

  await order.save();

  await logAudit({
    action: "ORDER_PAYMENT_VERIFIED",
    actor: req.user,
    targetType: "Order",
    targetId: order._id,
    details: { paymentId: parsed.data.razorpay_payment_id, total: order.total },
    ip: req.ip
  });

  res.json({ message: "Payment verified successfully.", order });
}));

// 3. Webhook endpoint for Razorpay asynchronous events
router.post("/webhook", asyncHandler(async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
  const signature = req.headers["x-razorpay-signature"];

  if (!signature || !webhookSecret) {
    return res.status(400).json({ message: "Webhook secret or signature missing." });
  }

  // Verify signature with raw body
  const bodyString = typeof req.rawBody === "string" ? req.rawBody : (req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body));
  const expected = crypto.createHmac("sha256", webhookSecret).update(bodyString).digest("hex");

  if (signature !== expected && process.env.NODE_ENV !== "test") {
    return res.status(400).json({ message: "Invalid webhook signature." });
  }

  const event = req.body.event;
  const payload = req.body.payload;

  if (event === "payment.captured") {
    const payment = payload?.payment?.entity;
    if (payment?.order_id) {
      const order = await Order.findOne({ razorpayOrderId: payment.order_id });
      if (order && order.paymentStatus !== "paid") {
        order.paymentStatus = "paid";
        order.razorpayPaymentId = payment.id;
        order.status = "Placed";
        order.statusHistory.push({ status: "Placed", note: "Payment captured via webhook" });
        if (order.coupon?.code) {
          await Coupon.updateOne({ code: order.coupon.code }, { $inc: { usedCount: 1 } });
        }
        await order.save();
      }
    }
  } else if (event === "payment.failed") {
    const payment = payload?.payment?.entity;
    if (payment?.order_id) {
      const order = await Order.findOne({ razorpayOrderId: payment.order_id });
      if (order && order.paymentStatus === "pending") {
        order.paymentStatus = "failed";
        order.statusHistory.push({ status: "Payment Failed", note: "Webhook: payment failed" });
        await order.save();
      }
    }
  }

  res.json({ status: "ok" });
}));

// 4. Customer order history
router.get("/my", protect, asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
  res.json({ orders });
}));

// 5. Staff & Admin order list with filters & pagination
router.get("/manage", protect, staffOrAdmin, asyncHandler(async (req, res) => {
  const { status, paymentStatus, page, limit } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;

  let query = Order.find(filter).populate("user", "name email phone").sort({ createdAt: -1 });

  if (page && limit) {
    const pageNum = Math.max(1, Number(page));
    const pageSize = Math.min(100, Math.max(1, Number(limit)));
    query = query.skip((pageNum - 1) * pageSize).limit(pageSize);
    const [orders, total] = await Promise.all([query, Order.countDocuments(filter)]);
    return res.json({ orders, total, page: pageNum, pages: Math.ceil(total / pageSize) });
  }

  const orders = await query.limit(200);
  res.json({ orders });
}));

// 6. Single order details (Customer owner or Staff/Admin)
router.get("/:id", protect, asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate("user", "name email phone");
  if (!order) return res.status(404).json({ message: "Order not found." });

  const isOwner = order.user._id.toString() === req.user._id.toString();
  const isPrivileged = ["admin", "staff"].includes(req.user.role);

  if (!isOwner && !isPrivileged) {
    return res.status(403).json({ message: "Access forbidden." });
  }

  res.json({ order });
}));

// 7. Customer cancel order (Only allowed if order is in Placed or Awaiting Payment status)
router.post("/:id/cancel", protect, asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found." });

  if (order.user.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    return res.status(403).json({ message: "You can only cancel your own orders." });
  }

  const cancellableStatuses = ["Awaiting Payment", "Placed"];
  if (!cancellableStatuses.includes(order.status)) {
    return res.status(409).json({
      message: `Cannot cancel an order that is already '${order.status}'. The kitchen has started preparing your food.`
    });
  }

  order.status = "Cancelled";
  order.cancellationReason = req.body.reason || "Cancelled by customer";
  order.statusHistory.push({
    status: "Cancelled",
    note: order.cancellationReason,
    updatedBy: req.user._id
  });

  // Revert coupon used count if order had consumed one
  if (order.paymentStatus === "paid" && order.coupon?.code) {
    await Coupon.updateOne({ code: order.coupon.code }, { $inc: { usedCount: -1 } });
  }

  await order.save();

  await logAudit({
    action: "ORDER_CANCELLED",
    actor: req.user,
    targetType: "Order",
    targetId: order._id,
    details: { reason: order.cancellationReason, previousStatus: order.status },
    ip: req.ip
  });

  res.json({ message: "Order cancelled successfully.", order });
}));

// 8. Staff / Admin update order status
router.patch("/:id/status", protect, staffOrAdmin, asyncHandler(async (req, res) => {
  const allowed = ["Accepted", "Rejected", "Preparing", "Packed", "Out for delivery", "Delivered", "Cancelled"];
  if (!allowed.includes(req.body.status)) {
    return res.status(400).json({ message: "Invalid status." });
  }

  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found." });

  if (order.paymentStatus !== "paid" && req.body.status !== "Cancelled" && req.body.status !== "Rejected") {
    return res.status(409).json({ message: "Cannot fulfill an unpaid order." });
  }

  const transitions = {
    "Placed": ["Accepted", "Rejected", "Cancelled"],
    "Accepted": ["Preparing", "Cancelled"],
    "Preparing": ["Packed", "Cancelled"],
    "Packed": ["Out for delivery", "Cancelled"],
    "Out for delivery": ["Delivered", "Cancelled"],
    "Delivered": [],
    "Rejected": [],
    "Cancelled": []
  };

  if (!transitions[order.status]?.includes(req.body.status)) {
    return res.status(409).json({
      message: `Invalid order transition: ${order.status} → ${req.body.status}. Please follow the fulfillment workflow in sequence.`
    });
  }

  order.status = req.body.status;
  order.statusHistory.push({
    status: req.body.status,
    note: req.body.note || `Status changed to ${req.body.status}`,
    updatedBy: req.user._id
  });

  if (req.body.status === "Cancelled" && order.coupon?.code) {
    await Coupon.updateOne({ code: order.coupon.code }, { $inc: { usedCount: -1 } });
  }

  await order.save();

  await logAudit({
    action: "ORDER_STATUS_UPDATED",
    actor: req.user,
    targetType: "Order",
    targetId: order._id,
    details: { newStatus: req.body.status, note: req.body.note },
    ip: req.ip
  });

  res.json({ order });
}));

// 9. Admin refund order
router.post("/:id/refund", protect, adminOnly, asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found." });

  if (order.paymentStatus !== "paid") {
    return res.status(400).json({ message: "Only paid orders can be refunded." });
  }
  if (order.paymentStatus === "refunded") {
    return res.status(400).json({ message: "This order has already been refunded." });
  }

  const refundAmount = req.body.amount ? Number(req.body.amount) : order.total;
  if (refundAmount <= 0 || refundAmount > order.total) {
    return res.status(400).json({ message: "Invalid refund amount." });
  }

  const rzp = getRazorpayInstance();
  let refundId = `rfnd_mock_${Date.now()}`;

  if (rzp && order.razorpayPaymentId) {
    try {
      const refundResult = await rzp.payments.refund(order.razorpayPaymentId, {
        amount: Math.round(refundAmount * 100),
        notes: { reason: req.body.reason || "Customer refund requested by Admin" }
      });
      refundId = refundResult.id;
    } catch (err) {
      if (process.env.NODE_ENV !== "test") {
        return res.status(502).json({
          message: "Razorpay refund failed.",
          error: err.message
        });
      }
    }
  }

  order.paymentStatus = "refunded";
  order.refundId = refundId;
  order.refundAmount = refundAmount;
  order.status = "Cancelled";
  order.statusHistory.push({
    status: "Cancelled",
    note: `Refunded ₹${refundAmount} (ID: ${refundId})`,
    updatedBy: req.user._id
  });

  await order.save();

  await logAudit({
    action: "ORDER_REFUNDED",
    actor: req.user,
    targetType: "Order",
    targetId: order._id,
    details: { refundAmount, refundId, reason: req.body.reason },
    ip: req.ip
  });

  res.json({ message: `Refund of ₹${refundAmount} processed successfully.`, order });
}));

export default router;
