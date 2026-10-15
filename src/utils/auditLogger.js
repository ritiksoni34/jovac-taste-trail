import AuditLog from "../models/AuditLog.js";

export async function logAudit({ action, actor, targetType, targetId, details = {}, ip = "" }) {
  try {
    const safeDetails = { ...details };
    delete safeDetails.password;
    delete safeDetails.passwordHash;
    delete safeDetails.token;
    delete safeDetails.key_secret;

    await AuditLog.create({
      action,
      actor: actor?._id || actor?.id,
      actorName: actor?.name || "System",
      actorRole: actor?.role || "system",
      targetType,
      targetId: targetId ? targetId.toString() : undefined,
      details: safeDetails,
      ip
    });
  } catch (err) {
    console.error("Audit logging error:", err.message);
  }
}
