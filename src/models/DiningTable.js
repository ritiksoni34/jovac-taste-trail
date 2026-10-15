import mongoose from "mongoose";
const diningTableSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: { type: String, required: true, enum: ["Solo Sanctuary", "Cozy Duo", "Signature Quartet", "Celebration Eight", "Grand Gathering"] },
  capacity: { type: Number, required: true, enum: [1, 2, 4, 8, 10] },
  pricePerHour: { type: Number, required: true, min: 0 },
  area: { type: String, enum: ["Garden", "Window", "Lounge", "Private Room"], default: "Dining Room" },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
export default mongoose.model("DiningTable", diningTableSchema);
