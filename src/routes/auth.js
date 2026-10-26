import { Router } from "express"; 
import bcrypt from "bcryptjs"; 
import jwt from "jsonwebtoken"; 
import { z } from "zod"; // For input validation
import User from "../models/User.js";
import { protect, adminOnly } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logAudit } from "../utils/auditLogger.js";


const router = Router();

const credentials = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(100),
  phone: z.string().trim().optional()
});

function tokenFor(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" } // Default to 7 days if not set
  );
}

function publicUser(user) {
  return {
    id: user._id,
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    phone: user.phone || "",
    address: user.address || { line1: "", city: "", postalCode: "" }
  };
}

// 1. Customer registration
router.post("/register", asyncHandler(async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Please enter a valid name, email, and password of at least 8 characters.",
      errors: parsed.error.flatten()
    });
  }
  const { name, email, password, phone } = parsed.data;
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }

  // Force customer role and active status
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    phone: phone || "",
    passwordHash: await bcrypt.hash(password, 12),
    role: "customer",
    status: "active"
  });

  await logAudit({
    action: "USER_REGISTERED",
    actor: user,
    targetType: "User",
    targetId: user._id,
    details: { role: "customer" },
    ip: req.ip
  });

  res.status(201).json({ token: tokenFor(user), user: publicUser(user) });
}));

// 2. Staff registration request (requires Admin approval)
router.post("/register-staff", asyncHandler(async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Please enter a valid name, email, and password of at least 8 characters.",
      errors: parsed.error.flatten()
    });
  }
  const { name, email, password, phone } = parsed.data;
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    phone: phone || "",
    passwordHash: await bcrypt.hash(password, 12),
    role: "staff",
    status: "pending" // Pending approval from Admin
  });

  await logAudit({
    action: "STAFF_REQUEST_SUBMITTED",
    actor: user,
    targetType: "User",
    targetId: user._id,
    details: { role: "staff", status: "pending" },
    ip: req.ip
  });

  res.status(201).json({
    message: "Staff application submitted successfully. An administrator will review your account before access is granted.",
    user: publicUser(user)
  });
}));

// 3. User login
router.post("/login", asyncHandler(async (req, res) => {
  const schema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(1)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Enter a valid email and password." });
  }

  const user = await User.findOne({ email: parsed.data.email.toLowerCase() }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ message: "Incorrect email or password." });
  }

  if (user.status === "blocked") {
    return res.status(403).json({ message: "Your account has been deactivated. Please contact support." });
  }
  if (user.role === "staff" && user.status === "pending") {
    return res.status(403).json({ message: "Your staff account is pending administrator approval." });
  }

  res.json({ token: tokenFor(user), user: publicUser(user) });
}));

// 4. Current user profile
router.get("/me", protect, asyncHandler(async (req, res) => {
  res.json({ user: publicUser(req.user) });
}));

// 5. Update user profile
router.put("/profile", protect, asyncHandler(async (req, res) => {
  const updateSchema = z.object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: z.string().trim().max(20).optional(),
    address: z.object({
      line1: z.string().trim().optional(),
      city: z.string().trim().optional(),
      postalCode: z.string().trim().optional()
    }).optional()
  });

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid profile data.", errors: parsed.error.flatten() });
  }

  if (parsed.data.name) req.user.name = parsed.data.name;
  if (parsed.data.phone !== undefined) req.user.phone = parsed.data.phone;
  if (parsed.data.address) {
    req.user.address = {
      line1: parsed.data.address.line1 || req.user.address?.line1 || "",
      city: parsed.data.address.city || req.user.address?.city || "",
      postalCode: parsed.data.address.postalCode || req.user.address?.postalCode || ""
    };
  }

  await req.user.save();
  res.json({ message: "Profile updated successfully.", user: publicUser(req.user) });
}));

// 6. Change password
router.put("/change-password", protect, asyncHandler(async (req, res) => {
  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(100)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "New password must be at least 8 characters long." });
  }

  const user = await User.findById(req.user._id).select("+passwordHash");
  const isMatch = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ message: "Current password does not match." });
  }

  user.passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await user.save();

  await logAudit({
    action: "PASSWORD_CHANGED",
    actor: user,
    targetType: "User",
    targetId: user._id,
    ip: req.ip
  });

  res.json({ message: "Password updated successfully." });
}));

// 7. Secure development bootstrap for initial Admin
router.post("/setup-admin", asyncHandler(async (req, res) => {
  const adminCount = await User.countDocuments({ role: "admin" });
  if (adminCount > 0) {
    return res.status(403).json({ message: "An administrator already exists. Setup endpoint is disabled." });
  }

  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Provide valid name, email, and password (at least 8 chars)." });
  }

  const { name, email, password } = parsed.data;
  const admin = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash: await bcrypt.hash(password, 12),
    role: "admin",
    status: "active"
  });

  await logAudit({
    action: "INITIAL_ADMIN_PROVISIONED",
    actor: admin,
    targetType: "User",
    targetId: admin._id,
    details: { email: admin.email },
    ip: req.ip
  });

  res.status(201).json({
    message: "Initial administrator account created successfully.",
    token: tokenFor(admin),
    user: publicUser(admin)
  });
}));

export default router;
