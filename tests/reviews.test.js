import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import MenuItem from "../src/models/MenuItem.js";
import Order from "../src/models/Order.js";

describe("Reviews & Customer Feedback", () => {
  let customerToken = "";
  let adminToken = "";
  let deliveredOrder = null;
  let menuItem = null;

  beforeAll(async () => {
    // 1. Admin login
    const adminRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@tastetrail.com", password: "TasteTrail@2026" });
    adminToken = adminRes.body.token;

    // 2. Customer login
    const custRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer@tastetrail.com", password: "TasteTrail@2026" });
    customerToken = custRes.body.token;

    // 3. Create a delivered order for testing reviews
    menuItem = await MenuItem.findOne({ isAvailable: true });
    const custUser = custRes.body.user;

    deliveredOrder = await Order.create({
      user: custUser._id,
      items: [{
        menuItem: menuItem._id,
        name: menuItem.name,
        quantity: 1,
        unitPrice: menuItem.price
      }],
      address: {
        name: "Aria Sharma",
        phone: "+91 98765 43210",
        line1: "Park Road",
        city: "Mumbai",
        postalCode: "400001"
      },
      subtotal: menuItem.price,
      deliveryFee: 0,
      total: menuItem.price,
      currency: "INR",
      paymentStatus: "paid",
      status: "Delivered",
      statusHistory: [{ status: "Delivered" }]
    });
  });

  it("should allow customer to submit a review for their delivered order", async () => {
    const res = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        orderId: deliveredOrder._id.toString(),
        menuItemId: menuItem._id.toString(),
        rating: 5,
        comment: "Exceptional aroma and authentic flavors. Will definitely reorder!"
      });

    expect(res.status).toBe(201);
    expect(res.body.review.rating).toBe(5);
    expect(res.body.review.comment).toContain("Exceptional aroma");
  });

  it("should prevent duplicate reviews for the same order item", async () => {
    const res = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        orderId: deliveredOrder._id.toString(),
        menuItemId: menuItem._id.toString(),
        rating: 4,
        comment: "Second attempt at reviewing the same dish"
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("already submitted a review");
  });

  it("should fetch public reviews", async () => {
    const res = await request(app)
      .get("/api/reviews")
      .query({ menuItemId: menuItem._id.toString() });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.reviews)).toBe(true);
    expect(res.body.reviews.some(r => r.order.toString() === deliveredOrder._id.toString())).toBe(true);
  });
});
