import { Router } from "express";
import { z } from "zod";
import Reservation from "../models/Reservation.js";
import DiningTable from "../models/DiningTable.js";
import { protect, adminOnly, staffOrAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logAudit } from "../utils/auditLogger.js";

const router = Router();

const slotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.coerce.number().int().refine(v => [60, 90, 120, 180].includes(v)).default(120),
  guests: z.coerce.number().int().min(1).max(10)
});

function getInterval(date, time, durationMinutes) {
  const startAt = new Date(`${date}T${time}:00`);
  return { startAt, endAt: new Date(startAt.getTime() + durationMinutes * 60000) };
}

async function getAvailability({ date, time, durationMinutes, guests }) {
  const { startAt, endAt } = getInterval(date, time, durationMinutes);
  if (!Number.isFinite(startAt.getTime())) {
    return { error: "Please choose a valid date and time." };
  }
  if (startAt <= new Date()) {
    return { error: "Reservations must be made for future dates and times." };
  }

  // Restaurant operating hours: 11:00 AM to 11:00 PM (23:00)
  const [hour, min] = time.split(":").map(Number);
  const startHourFraction = hour + min / 60;
  const endHourFraction = startHourFraction + durationMinutes / 60;
  if (startHourFraction < 11 || endHourFraction > 23.5) {
    return { error: "Reservations are available only during opening hours (11:00 AM to 11:00 PM)." };
  }

  const tables = await DiningTable.find({ isActive: true, capacity: { $gte: guests } })
    .sort({ capacity: 1, pricePerHour: 1 });

  const conflicts = await Reservation.find({
    status: "Confirmed",
    startAt: { $lt: endAt },
    endAt: { $gt: startAt }
  }).select("table");

  const busySet = new Set(conflicts.map(r => r.table.toString()));

  return {
    startAt,
    endAt,
    tables: tables.map(t => ({
      id: t._id,
      code: t.code,
      name: t.name,
      type: t.type,
      capacity: t.capacity,
      pricePerHour: t.pricePerHour,
      estimatedPrice: Math.round((t.pricePerHour * durationMinutes) / 60),
      area: t.area,
      available: !busySet.has(t._id.toString())
    })).sort((a, b) => Number(b.available) - Number(a.available) || a.capacity - b.capacity || a.pricePerHour - b.pricePerHour)
  };
}

// 1. List active dining tables
router.get("/tables", asyncHandler(async (_req, res) => {
  const tables = await DiningTable.find({ isActive: true }).sort({ capacity: 1, code: 1 });
  res.json({ tables });
}));

// 2. Admin manage dining tables (pricing, availability, names)
router.get("/tables/manage", protect, adminOnly, asyncHandler(async (_req, res) => {
  const tables = await DiningTable.find().sort({ capacity: 1, code: 1 });
  res.json({ tables });
}));

router.patch("/tables/:id", protect, adminOnly, asyncHandler(async (req, res) => {
  const allowed = {};
  for (const key of ["name", "pricePerHour", "area", "isActive", "type", "capacity"]) {
    if (req.body[key] !== undefined) allowed[key] = req.body[key];
  }
  const table = await DiningTable.findByIdAndUpdate(req.params.id, allowed, { new: true, runValidators: true });
  if (!table) return res.status(404).json({ message: "Dining table not found." });

  await logAudit({
    action: "TABLE_UPDATED",
    actor: req.user,
    targetType: "DiningTable",
    targetId: table._id,
    details: allowed,
    ip: req.ip
  });

  res.json({ table });
}));

// 3. Check real-time table availability
router.get("/availability", asyncHandler(async (req, res) => {
  const parsed = slotSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Please specify a valid date (YYYY-MM-DD), time (HH:MM), duration, and guest count (1-10)." });
  }

  const result = await getAvailability(parsed.data);
  if (result.error) {
    return res.status(400).json({ message: result.error });
  }

  res.json({ startAt: result.startAt, endAt: result.endAt, tables: result.tables });
}));

// 4. Create new reservation
router.post("/", protect, asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().email(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    durationMinutes: z.number().int().refine(v => [60, 90, 120, 180].includes(v)).default(120),
    guests: z.number().int().min(1).max(10),
    tableId: z.string().min(1),
    notes: z.string().max(500).optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Please check your reservation details." });
  }

  const { date, time, durationMinutes, guests, tableId } = parsed.data;
  const available = await getAvailability({ date, time, durationMinutes, guests });
  if (available.error) {
    return res.status(400).json({ message: available.error });
  }

  const selectedCandidate = available.tables.find(t => t.id.toString() === tableId);
  if (!selectedCandidate || !selectedCandidate.available) {
    return res.status(409).json({ message: "That table is not available for this time slot. Please choose another table or time." });
  }

  const rawTable = await DiningTable.findById(tableId);
  if (!rawTable || !rawTable.isActive) {
    return res.status(404).json({ message: "Selected table is inactive or unavailable." });
  }
  if (rawTable.capacity < guests) {
    return res.status(400).json({ message: `The selected table accommodates up to ${rawTable.capacity} guests.` });
  }

  // Atomic conflict check right before saving to prevent double-booking
  const conflict = await Reservation.exists({
    table: tableId,
    status: "Confirmed",
    startAt: { $lt: available.endAt },
    endAt: { $gt: available.startAt }
  });

  if (conflict) {
    return res.status(409).json({ message: "This table was just booked by another guest. Please select an alternate table." });
  }

  const price = Math.round((rawTable.pricePerHour * durationMinutes) / 60);

  const reservation = await Reservation.create({
    user: req.user._id,
    table: rawTable._id,
    tableCode: rawTable.code,
    tableName: rawTable.name,
    tableType: rawTable.type,
    tablePrice: price,
    name: parsed.data.name,
    email: parsed.data.email,
    date: available.startAt,
    time,
    startAt: available.startAt,
    endAt: available.endAt,
    durationMinutes,
    guests,
    notes: parsed.data.notes || "",
    status: "Confirmed"
  });

  await logAudit({
    action: "RESERVATION_CREATED",
    actor: req.user,
    targetType: "Reservation",
    targetId: reservation._id,
    details: { table: rawTable.name, startAt: available.startAt, guests },
    ip: req.ip
  });

  res.status(201).json({
    reservation,
    message: `${rawTable.name} has been successfully reserved for your party!`
  });
}));

// 5. Customer's own reservations
router.get("/mine", protect, asyncHandler(async (req, res) => {
  const reservations = await Reservation.find({ user: req.user._id }).sort({ startAt: -1 });
  res.json({ reservations });
}));

// 6. Customer cancel own reservation
router.post("/:id/cancel", protect, asyncHandler(async (req, res) => {
  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) return res.status(404).json({ message: "Reservation not found." });

  if (reservation.user.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    return res.status(403).json({ message: "You can only cancel your own reservation." });
  }

  if (reservation.status !== "Confirmed") {
    return res.status(400).json({ message: `Reservation is already marked as ${reservation.status}.` });
  }

  reservation.status = "Cancelled";
  await reservation.save();

  await logAudit({
    action: "RESERVATION_CANCELLED",
    actor: req.user,
    targetType: "Reservation",
    targetId: reservation._id,
    details: { table: reservation.tableName, startAt: reservation.startAt },
    ip: req.ip
  });

  res.json({ message: "Reservation cancelled successfully.", reservation });
}));

// 7. Staff & Admin list reservations with date filtering
router.get("/", protect, staffOrAdmin, asyncHandler(async (req, res) => {
  const { date, status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (date) {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);
    filter.startAt = { $gte: dayStart, $lte: dayEnd };
  }

  const reservations = await Reservation.find(filter)
    .populate("user", "name email phone")
    .sort({ startAt: 1 })
    .limit(500);

  res.json({ reservations });
}));

// 8. Staff & Admin update reservation status
router.patch("/:id/status", protect, staffOrAdmin, asyncHandler(async (req, res) => {
  const allowed = ["Confirmed", "Cancelled", "Completed", "No-show"];
  if (!allowed.includes(req.body.status)) {
    return res.status(400).json({ message: "Invalid reservation status." });
  }

  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) return res.status(404).json({ message: "Reservation not found." });

  const oldStatus = reservation.status;
  reservation.status = req.body.status;
  await reservation.save();

  await logAudit({
    action: "RESERVATION_STATUS_UPDATED",
    actor: req.user,
    targetType: "Reservation",
    targetId: reservation._id,
    details: { oldStatus, newStatus: reservation.status, table: reservation.tableName },
    ip: req.ip
  });

  res.json({ reservation });
}));

export default router;
