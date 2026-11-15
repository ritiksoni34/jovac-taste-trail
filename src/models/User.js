import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  phone: { type: String, trim: true, default: "" },
  role: { type: String, enum: ["customer", "staff", "admin"], default: "customer", index: true },
  status: { type: String, enum: ["active", "pending", "blocked"], default: "active", index: true },
  address: {
    line1: { type: String, default: "" },
    city: { type: String, default: "" },
    postalCode: { type: String, default: "" }
  }
}, { timestamps: true });

userSchema.index({ email: 1, status: 1 });

export default mongoose.model("User", userSchema);
