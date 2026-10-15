import mongoose from "mongoose";
const reservationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  table: { type: mongoose.Schema.Types.ObjectId, ref: "DiningTable", required: true },
  tableCode: { type: String, required: true }, tableName: { type: String, required: true },
  tableType: { type: String, required: true }, tablePrice: { type: Number, required: true },
  name: { type: String, required: true, trim: true }, email: { type: String, required: true, lowercase: true, trim: true },
  date: { type: Date, required: true, index: true }, time: { type: String, required: true },
  startAt: { type: Date, required: true, index: true }, endAt: { type: Date, required: true, index: true },
  durationMinutes: { type: Number, required: true, enum: [60, 90, 120, 180] },
  guests: { type: Number, required: true, min: 1, max: 10 }, notes: { type: String, maxlength: 500 },
  status: { type: String, enum: ["Confirmed", "Cancelled", "Completed", "No-show"], default: "Confirmed", index: true }
}, { timestamps: true });
reservationSchema.index({ table: 1, startAt: 1, endAt: 1, status: 1 });
export default mongoose.model("Reservation", reservationSchema);
