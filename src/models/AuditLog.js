import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  actorName: { type: String, default: "System" },
  actorRole: { type: String, default: "system" },
  targetType: { type: String, required: true, index: true },
  targetId: { type: String, index: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, default: "" }
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);
