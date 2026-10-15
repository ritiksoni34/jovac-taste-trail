import mongoose from "mongoose";
const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 32 },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, maxlength: 300, default: "" },
  type: { type: String, enum: ["percentage", "fixed"], required: true },
  value: { type: Number, required: true, min: 1 },
  maxDiscount: { type: Number, min: 0, default: null },
  minOrderAmount: { type: Number, min: 0, default: 0 },
  visibility: { type: String, enum: ["public", "private"], default: "public" },
  eligibleUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  eligibleEmails: [{ type: String, lowercase: true, trim: true }],
  startsAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  usageLimit: { type: Number, min: 1, default: null },
  perUserLimit: { type: Number, min: 1, default: 1 },
  usedCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  firstOrderOnly: { type: Boolean, default: false }
}, { timestamps: true });
export default mongoose.model("Coupon", couponSchema);
