import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  userName: { type: String, required: true, trim: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem", index: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, trim: true, maxlength: 1000 },
  isApproved: { type: Boolean, default: true, index: true }
}, { timestamps: true });

// Prevent duplicate review for the same user and order (and menuItem if specified)
reviewSchema.index({ user: 1, order: 1, menuItem: 1 }, { unique: true });

export default mongoose.model("Review", reviewSchema);
