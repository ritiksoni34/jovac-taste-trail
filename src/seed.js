import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDB, disconnectDB } from "./config/db.js";
import MenuItem from "./models/MenuItem.js";
import DiningTable from "./models/DiningTable.js";
import User from "./models/User.js";
import Coupon from "./models/Coupon.js";

const dishes = [
  {
    name: "Truffle Wild Mushroom Risotto",
    description: "Creamy arborio rice, wild forest mushrooms, aged parmesan, and a delicate touch of white truffle oil.",
    price: 429,
    category: "Mains",
    image: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=1000&q=85",
    isFeatured: true,
    vegetarian: true,
    stock: 45,
    preparationTime: 25,
    dietaryTags: ["Vegetarian", "Chef's Special"]
  },
  {
    name: "Burrata Garden Salad",
    description: "Creamy artisanal burrata, heirloom garden tomatoes, baby arugula, basil, and 12-year aged Modena balsamic.",
    price: 349,
    category: "Starters",
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1000&q=85",
    isFeatured: true,
    vegetarian: true,
    stock: 30,
    preparationTime: 15,
    dietaryTags: ["Vegetarian", "Gluten-Free"]
  },
  {
    name: "Wood-Fired Margherita",
    description: "San Marzano tomatoes, fior di latte mozzarella, fragrant fresh basil, and a blistered sourdough crust.",
    price: 399,
    category: "Pizza",
    image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1000&q=85",
    isFeatured: true,
    vegetarian: true,
    stock: 50,
    preparationTime: 20,
    dietaryTags: ["Vegetarian", "Classic"]
  },
  {
    name: "Smoky Paneer Skewers",
    description: "Charcoal-roasted cottage cheese cubes marinated in Kashmiri chili, bell peppers, and mint-coriander emulsion.",
    price: 289,
    category: "Starters",
    image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=1000&q=85",
    vegetarian: true,
    stock: 40,
    preparationTime: 20,
    dietaryTags: ["Vegetarian", "Spicy"]
  },
  {
    name: "Dark Chocolate Fondant",
    description: "Warm single-origin Belgian chocolate cake with a molten center, served with Madagascar vanilla bean gelato.",
    price: 249,
    category: "Desserts",
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=1000&q=85",
    isFeatured: true,
    vegetarian: true,
    stock: 25,
    preparationTime: 15,
    dietaryTags: ["Vegetarian", "Dessert"]
  },
  {
    name: "Rose & Lychee Cooler",
    description: "Muddled lychee, fresh Mediterranean lime, organic rose extract, and chilled sparkling spring water.",
    price: 159,
    category: "Drinks",
    image: "https://images.unsplash.com/photo-1513558161293-cdaf765edfd7?auto=format&fit=crop&w=1000&q=85",
    vegetarian: true,
    stock: 60,
    preparationTime: 10,
    dietaryTags: ["Vegan", "Mocktail"]
  },
  {
    name: "Creamy Pesto Pasta",
    description: "House-made penne tossed in fresh Genoese basil pesto, toasted pine nuts, parmesan, and slow-roasted cherry tomatoes.",
    price: 379,
    category: "Mains",
    image: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1000&q=85",
    vegetarian: true,
    stock: 35,
    preparationTime: 20,
    dietaryTags: ["Vegetarian"]
  },
  {
    name: "Classic Tiramisu",
    description: "Savoiardi ladyfingers soaked in dark roast espresso and Amaretto essence, layered with velvety mascarpone crema.",
    price: 229,
    category: "Desserts",
    image: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=1000&q=85",
    vegetarian: true,
    stock: 30,
    preparationTime: 10,
    dietaryTags: ["Vegetarian", "Signature"]
  }
];

const tableGroups = [
  { type: "Solo Sanctuary", capacity: 1, pricePerHour: 199, area: "Window", prefix: "S" },
  { type: "Cozy Duo", capacity: 2, pricePerHour: 299, area: "Garden", prefix: "D" },
  { type: "Signature Quartet", capacity: 4, pricePerHour: 499, area: "Window", prefix: "Q" },
  { type: "Celebration Eight", capacity: 8, pricePerHour: 899, area: "Lounge", prefix: "E" },
  { type: "Grand Gathering", capacity: 10, pricePerHour: 1299, area: "Private Room", prefix: "G" }
];

async function seed() {
  await connectDB();

  console.log("Seeding menu items...");
  for (const dish of dishes) {
    await MenuItem.updateOne({ name: dish.name }, { $set: dish }, { upsert: true });
  }

  console.log("Seeding 40 dining tables (8 per type)...");
  let tableCount = 0;
  for (const group of tableGroups) {
    for (let i = 1; i <= 8; i++) {
      const code = `${group.prefix}${String(i).padStart(2, "0")}`;
      await DiningTable.updateOne(
        { code },
        {
          $set: {
            code,
            name: `${group.type} ${String(i).padStart(2, "0")}`,
            type: group.type,
            capacity: group.capacity,
            pricePerHour: group.pricePerHour,
            area: group.area,
            isActive: true
          }
        },
        { upsert: true }
      );
      tableCount++;
    }
  }

  console.log("Seeding default coupon offers...");
  const defaultCoupons = [
    {
      code: "WELCOME10",
      title: "Welcome Delight",
      description: "Enjoy 10% off on your first fine dining delivery.",
      type: "percentage",
      value: 10,
      maxDiscount: 200,
      minOrderAmount: 399,
      visibility: "public",
      startsAt: new Date(Date.now() - 86400000),
      expiresAt: new Date(Date.now() + 180 * 86400000),
      perUserLimit: 1,
      isActive: true
    },
    {
      code: "TASTE50",
      title: "Flat ₹50 Celebration",
      description: "Flat ₹50 savings on any feast above ₹499.",
      type: "fixed",
      value: 50,
      minOrderAmount: 499,
      visibility: "public",
      startsAt: new Date(Date.now() - 86400000),
      expiresAt: new Date(Date.now() + 180 * 86400000),
      perUserLimit: 3,
      isActive: true
    },
    {
      code: "FEAST100",
      title: "Feast Master",
      description: "Flat ₹100 discount on group orders above ₹999.",
      type: "fixed",
      value: 100,
      minOrderAmount: 999,
      visibility: "public",
      startsAt: new Date(Date.now() - 86400000),
      expiresAt: new Date(Date.now() + 180 * 86400000),
      perUserLimit: 2,
      isActive: true
    }
  ];

  for (const c of defaultCoupons) {
    await Coupon.updateOne({ code: c.code }, { $set: c }, { upsert: true });
  }

  console.log("Seeding initial users (Admin, Staff, Customer)...");
  const defaultPasswordHash = await bcrypt.hash("TasteTrail@2026", 12);

  const initialUsers = [
    {
      name: "TasteTrail Admin",
      email: "admin@tastetrail.com",
      passwordHash: defaultPasswordHash,
      role: "admin",
      status: "active",
      phone: "+91 98765 43210"
    },
    {
      name: "Chef Marco (Staff)",
      email: "staff@tastetrail.com",
      passwordHash: defaultPasswordHash,
      role: "staff",
      status: "active",
      phone: "+91 98765 43211"
    },
    {
      name: "Aria Sharma (Customer)",
      email: "customer@tastetrail.com",
      passwordHash: defaultPasswordHash,
      role: "customer",
      status: "active",
      phone: "+91 98765 43212"
    }
  ];

  for (const u of initialUsers) {
    const exists = await User.findOne({ email: u.email });
    if (!exists) {
      await User.create(u);
    }
  }

  console.log(`\n==========================================`);
  console.log(`TasteTrail Database Seed Complete!`);
  console.log(`- ${dishes.length} gourmet dishes`);
  console.log(`- ${tableCount} dining tables across 5 categories`);
  console.log(`- ${defaultCoupons.length} promotional coupons`);
  console.log(`- Default test accounts seeded:`);
  console.log(`  * Admin: admin@tastetrail.com (Password: TasteTrail@2026)`);
  console.log(`  * Staff: staff@tastetrail.com (Password: TasteTrail@2026)`);
  console.log(`  * Customer: customer@tastetrail.com (Password: TasteTrail@2026)`);
  console.log(`==========================================\n`);

  await disconnectDB();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
