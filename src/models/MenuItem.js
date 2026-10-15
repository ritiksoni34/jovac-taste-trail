import mongoose from "mongoose";

const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 1 },
  discountedPrice: { type: Number, min: 0 },
  category: { type: String, required: true, enum: ["Starters", "Mains", "Pizza", "Desserts", "Drinks"], index: true },
  image: { type: String, required: true },
  isAvailable: { type: Boolean, default: true, index: true },
  isFeatured: { type: Boolean, default: false, index: true },
  vegetarian: { type: Boolean, default: true },
  stock: { type: Number, default: 50, min: 0 },
  preparationTime: { type: Number, default: 20, min: 1 },
  dietaryTags: [{ type: String, trim: true }],
  rating: { type: Number, default: 5, min: 1, max: 5 },
  numReviews: { type: Number, default: 0 }
}, { timestamps: true });

menuItemSchema.index({ name: "text", description: "text" });

export default mongoose.model("MenuItem", menuItemSchema);
