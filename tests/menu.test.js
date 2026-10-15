import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("Menu & Kitchen Catalogue", () => {
  let adminToken = "";
  let staffToken = "";
  let customerToken = "";
  let createdItemId = "";

  beforeAll(async () => {
    // Admin login
    const adminRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@tastetrail.com", password: "TasteTrail@2026" });
    adminToken = adminRes.body.token;

    // Staff login
    const staffRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "staff@tastetrail.com", password: "TasteTrail@2026" });
    staffToken = staffRes.body.token;

    // Customer login
    const custRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer@tastetrail.com", password: "TasteTrail@2026" });
    customerToken = custRes.body.token;
  });

  it("should fetch public menu items", async () => {
    const res = await request(app).get("/api/menu");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0]).toHaveProperty("name");
    expect(res.body.items[0]).toHaveProperty("price");
  });

  it("should filter menu items by category", async () => {
    const res = await request(app).get("/api/menu?category=Desserts");
    expect(res.status).toBe(200);
    expect(res.body.items.every(i => i.category === "Desserts")).toBe(true);
  });

  it("should filter menu items by search query", async () => {
    const res = await request(app).get("/api/menu?search=Risotto");
    expect(res.status).toBe(200);
    expect(res.body.items.some(i => i.name.includes("Risotto"))).toBe(true);
  });

  it("should return categories with counts", async () => {
    const res = await request(app).get("/api/menu/categories");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.categories)).toBe(true);
    expect(res.body.categories.some(c => c.name === "Pizza" && c.count > 0)).toBe(true);
  });

  it("should allow admin to create a new dish", async () => {
    const res = await request(app)
      .post("/api/menu")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Artisanal Saffron Tagliatelle",
        description: "Handmade ribbons tossed in saffron butter and pine nuts.",
        price: 480,
        category: "Mains",
        image: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1000&q=85",
        isFeatured: true,
        vegetarian: true
      });

    expect(res.status).toBe(201);
    expect(res.body.item.name).toBe("Artisanal Saffron Tagliatelle");
    createdItemId = res.body.item._id;
  });

  it("should prevent customer from creating a menu item", async () => {
    const res = await request(app)
      .post("/api/menu")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        name: "Unauthorized Burger",
        description: "Delicious illegal burger",
        price: 200,
        category: "Mains",
        image: "https://example.com/burger.jpg"
      });

    expect(res.status).toBe(403);
  });

  it("should allow staff to toggle dish availability but reject price edits", async () => {
    // Availability update allowed
    const toggleRes = await request(app)
      .put(`/api/menu/${createdItemId}`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ isAvailable: false });

    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.item.isAvailable).toBe(false);

    // Price change rejected for staff
    const priceRes = await request(app)
      .put(`/api/menu/${createdItemId}`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ price: 999 });

    expect(priceRes.status).toBe(403);
  });

  it("should allow admin to delete a dish", async () => {
    const res = await request(app)
      .delete(`/api/menu/${createdItemId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("deleted");
  });
});
