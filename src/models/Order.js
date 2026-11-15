import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  items: [{
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem", required: true },
    name: { type: String, required: true },
    image: String,
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 }
  }],
  address: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    city: { type: String, required: true },
    postalCode: { type: String, required: true }
  },
  subtotal: { type: Number, required: true },
  coupon: { code: String, title: String, discount: { type: Number, default: 0 } },
  discount: { type: Number, default: 0 },
  deliveryFee: { type: Number, default: 49 },
  total: { type: Number, required: true },
  currency: { type: String, default: "INR" },
  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "failed", "refunded"],
    default: "pending",
    index: true
  },
  paymentProvider: { type: String, default: "razorpay" },
  razorpayOrderId: { type: String, index: true },
  razorpayPaymentId: { type: String, index: true },
  refundId: String,
  refundAmount: Number,
  status: {
    type: String,
    enum: ["Awaiting Payment", "Placed", "Accepted", "Rejected", "Preparing", "Packed", "Out for delivery", "Delivered", "Cancelled"],
    default: "Awaiting Payment",
    index: true
  },
  statusHistory: [{
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    note: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  }],
  cancellationReason: String
}, { timestamps: true });

orderSchema.index({ createdAt: -1 });

export default mongoose.model("Order", orderSchema);
