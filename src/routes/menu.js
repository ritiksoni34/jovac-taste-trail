import { Router } from "express";
import { z } from "zod";
import MenuItem from "../models/MenuItem.js";
import { protect, adminOnly, staffOrAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logAudit } from "../utils/auditLogger.js";

const router = Router();

const itemSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(5).max(500),
  price: z.coerce.number().positive(),
  discountedPrice: z.coerce.number().min(0).optional(),
  category: z.enum(["Starters", "Mains", "Pizza", "Desserts", "Drinks"]),
  image: z.string().url(),
  isAvailable: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  vegetarian: z.boolean().optional(),
  stock: z.coerce.number().int().min(0).optional(),
  preparationTime: z.coerce.number().int().min(1).optional(),
  dietaryTags: z.array(z.string()).optional()
});

// 1. Public Menu: list items with filtering, search, sorting, pagination
router.get("/", asyncHandler(async (req, res) => {
  const { category, search, vegetarian, sort, minPrice, maxPrice, page, limit } = req.query;
  const filter = { isAvailable: true };

  if (category && ["Starters", "Mains", "Pizza", "Desserts", "Drinks"].includes(category)) {
    filter.category = category;
  }
  if (vegetarian === "true" || vegetarian === true) {
    filter.vegetarian = true;
  }
  if (search) {
    filter.name = { $regex: String(search).slice(0, 60), $options: "i" };
  }
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  let sortOption = { isFeatured: -1, createdAt: -1 };
  if (sort === "price-asc") sortOption = { price: 1 };
  else if (sort === "price-desc") sortOption = { price: -1 };
  else if (sort === "rating") sortOption = { rating: -1, numReviews: -1 };

  let query = MenuItem.find(filter).sort(sortOption);

  if (page && limit) {
    const pageNum = Math.max(1, Number(page));
    const pageSize = Math.min(100, Math.max(1, Number(limit)));
    query = query.skip((pageNum - 1) * pageSize).limit(pageSize);
    const [items, total] = await Promise.all([query, MenuItem.countDocuments(filter)]);
    return res.json({ items, total, page: pageNum, pages: Math.ceil(total / pageSize) });
  }

  const items = await query.limit(100);
  res.json({ items });
}));

// 2. Categories summary with item counts
router.get("/categories", asyncHandler(async (_req, res) => {
  const counts = await MenuItem.aggregate([
    { $match: { isAvailable: true } },
    { $group: { _id: "$category", count: { $sum: 1 } } }
  ]);
  const categories = ["Starters", "Mains", "Pizza", "Desserts", "Drinks"].map(name => {
    const found = counts.find(c => c._id === name);
    return { name, count: found ? found.count : 0 };
  });
  res.json({ categories });
}));

// 3. Admin / Staff Manage Menu
router.get("/manage", protect, staffOrAdmin, asyncHandler(async (_req, res) => {
  const items = await MenuItem.find().sort({ category: 1, isAvailable: -1, createdAt: -1 }).limit(300);
  res.json({ items });
}));

// 4. Single Menu Item
router.get("/:id", asyncHandler(async (req, res) => {
  const item = await MenuItem.findById(req.params.id);
  if (!item) return res.status(404).json({ message: "Menu item not found." });
  res.json({ item });
}));

// 5. Create Menu Item (Admin only)
router.post("/", protect, adminOnly, asyncHandler(async (req, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid menu item.", errors: parsed.error.flatten() });
  }

  const item = await MenuItem.create(parsed.data);

  await logAudit({
    action: "MENU_ITEM_CREATED",
    actor: req.user,
    targetType: "MenuItem",
    targetId: item._id,
    details: { name: item.name, price: item.price, category: item.category },
    ip: req.ip
  });

  res.status(201).json({ item });
}));

// 6. Update Menu Item (Admin or Staff for availability toggle)
router.put("/:id", protect, staffOrAdmin, asyncHandler(async (req, res) => {
  // If user is staff (not admin), they can only toggle availability
  if (req.user.role === "staff") {
    if (Object.keys(req.body).some(k => k !== "isAvailable")) {
      return res.status(403).json({ message: "Staff may only update dish availability." });
    }
  }

  const parsed = itemSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid menu item data." });
  }

  const item = await MenuItem.findByIdAndUpdate(req.params.id, parsed.data, { new: true, runValidators: true });
  if (!item) return res.status(404).json({ message: "Menu item not found." });

  await logAudit({
    action: "MENU_ITEM_UPDATED",
    actor: req.user,
    targetType: "MenuItem",
    targetId: item._id,
    details: parsed.data,
    ip: req.ip
  });

  res.json({ item });
}));

// 7. Delete Menu Item (Admin only)
router.delete("/:id", protect, adminOnly, asyncHandler(async (req, res) => {
  const item = await MenuItem.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ message: "Menu item not found." });

  await logAudit({
    action: "MENU_ITEM_DELETED",
    actor: req.user,
    targetType: "MenuItem",
    targetId: item._id,
    details: { name: item.name },
    ip: req.ip
  });

  res.json({ message: "Menu item deleted." });
}));

export default router;
