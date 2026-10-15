import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("Coupon Management & Cart Validation", () => {
  let adminToken = "";
  let customerToken = "";
  let testCouponId = "";
  const code = `TEST${Date.now().toString().slice(-4)}`;

  beforeAll(async () => {
    const adminRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@tastetrail.com", password: "TasteTrail@2026" });
    adminToken = adminRes.body.token;

    const custRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer@tastetrail.com", password: "TasteTrail@2026" });
    customerToken = custRes.body.token;
  });

  it("should list active public coupons", async () => {
    const res = await request(app).get("/api/coupons/public");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.coupons)).toBe(true);
    expect(res.body.coupons.some(c => c.code === "WELCOME10")).toBe(true);
  });

  it("should allow admin to create a percentage coupon with cap", async () => {
    const res = await request(app)
      .post("/api/coupons")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code,
        title: "Test 20% Off",
        description: "Special seasonal discount",
        type: "percentage",
        value: 20,
        maxDiscount: 150,
        minOrderAmount: 400,
        visibility: "public",
        startsAt: new Date(Date.now() - 3600000).toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        usageLimit: 50,
        perUserLimit: 2
      });

    expect(res.status).toBe(201);
    expect(res.body.coupon.code).toBe(code);
    testCouponId = res.body.coupon._id;
  });

  it("should validate and apply percentage coupon with cap", async () => {
    // 20% of 1000 is 200, but cap is 150
    const res = await request(app)
      .post("/api/coupons/validate")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ code, subtotal: 1000 });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.discount).toBe(150);
    expect(res.body.newSubtotal).toBe(850);
  });

  it("should reject coupon when subtotal is below minimum order amount", async () => {
    const res = await request(app)
      .post("/api/coupons/validate")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ code, subtotal: 200 }); // min is 400

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Minimum order amount");
  });

  it("should reject non-existent or expired coupon", async () => {
    const res = await request(app)
      .post("/api/coupons/validate")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ code: "FAKECOUPON999", subtotal: 500 });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("does not exist");
  });

  it("should prevent customer from creating coupons", async () => {
    const res = await request(app)
      .post("/api/coupons")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        code: "HACK99",
        title: "Free Food",
        type: "percentage",
        value: 100,
        startsAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString()
      });

    expect(res.status).toBe(403);
  });

  it("should allow admin to update and deactivate coupon", async () => {
    const res = await request(app)
      .patch(`/api/coupons/${testCouponId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.coupon.isActive).toBe(false);

    // Deactivated coupon should now fail validation
    const valRes = await request(app)
      .post("/api/coupons/validate")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ code, subtotal: 600 });
    expect(valRes.status).toBe(400);
  });
});
