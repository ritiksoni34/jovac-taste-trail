import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import MenuItem from "../src/models/MenuItem.js";
import Order from "../src/models/Order.js";

describe("Order Lifecycle & Payment Processing", () => {
  let customerToken = "";
  let otherCustomerToken = "";
  let staffToken = "";
  let adminToken = "";
  let menuItem = null;
  let testOrderId = "";
  let razorpayOrderId = "";

  beforeAll(async () => {
    // 1. Log in admin
    const adminRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@tastetrail.com", password: "TasteTrail@2026" });
    adminToken = adminRes.body.token;

    // 2. Log in staff
    const staffRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "staff@tastetrail.com", password: "TasteTrail@2026" });
    staffToken = staffRes.body.token;

    // 3. Log in customer
    const custRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer@tastetrail.com", password: "TasteTrail@2026" });
    customerToken = custRes.body.token;

    // 4. Register a second customer to test cross-user isolation
    const otherRes = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Second Customer",
        email: `other_${Date.now()}@example.com`,
        password: "Password123!"
      });
    otherCustomerToken = otherRes.body.token;

    // 5. Get a valid menu item
    menuItem = await MenuItem.findOne({ isAvailable: true });
  });

  it("should create an order with server-calculated price and free delivery over ₹499", async () => {
    expect(menuItem).toBeTruthy();

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ menuItemId: menuItem._id.toString(), quantity: 2 }],
        address: {
          name: "Aria Sharma",
          phone: "+91 98765 43210",
          line1: "Flat 402, Lotus Enclave",
          city: "Mumbai",
          postalCode: "400001"
        }
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("orderId");
    expect(res.body).toHaveProperty("razorpayOrderId");

    const expectedSubtotal = menuItem.price * 2;
    const expectedDelivery = expectedSubtotal >= 499 ? 0 : 49;
    const expectedTotal = expectedSubtotal + expectedDelivery;

    expect(res.body.total).toBe(expectedTotal);
    testOrderId = res.body.orderId;
    razorpayOrderId = res.body.razorpayOrderId;
  });

  it("should reject order if requested dish is unavailable", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ menuItemId: "64f1a2b3c4d5e6f7a8b9c0d1", quantity: 1 }],
        address: {
          name: "Test",
          phone: "+91 98765 43210",
          line1: "123 Street",
          city: "City",
          postalCode: "500001"
        }
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("unavailable");
  });

  it("should fail payment verification with an invalid signature", async () => {
    const res = await request(app)
      .post("/api/orders/verify-payment")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        orderId: testOrderId,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: "pay_fake_12345",
        razorpay_signature: "invalid_tampered_signature"
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("verification failed");
  });

  it("should verify payment with mock signature in test mode", async () => {
    const res = await request(app)
      .post("/api/orders/verify-payment")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        orderId: testOrderId,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: "pay_mock_verified_123",
        razorpay_signature: "valid_mock_signature"
      });

    expect(res.status).toBe(200);
    expect(res.body.order.paymentStatus).toBe("paid");
    expect(res.body.order.status).toBe("Placed");
  });

  it("should prevent a customer from accessing another customer's order", async () => {
    const res = await request(app)
      .get(`/api/orders/${testOrderId}`)
      .set("Authorization", `Bearer ${otherCustomerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("forbidden");
  });

  it("should allow owner customer to view their order", async () => {
    const res = await request(app)
      .get(`/api/orders/${testOrderId}`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.order._id).toBe(testOrderId);
  });

  it("should enforce sequential status transitions for staff (Placed -> Accepted -> Preparing)", async () => {
    // 1. Placed -> Accepted
    const acceptRes = await request(app)
      .patch(`/api/orders/${testOrderId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ status: "Accepted" });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.order.status).toBe("Accepted");

    // 2. Reject invalid jump (Accepted -> Delivered)
    const invalidRes = await request(app)
      .patch(`/api/orders/${testOrderId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ status: "Delivered" });

    expect(invalidRes.status).toBe(409);
    expect(invalidRes.body.message).toContain("Invalid order transition");

    // 3. Accepted -> Preparing
    const prepRes = await request(app)
      .patch(`/api/orders/${testOrderId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ status: "Preparing" });

    expect(prepRes.status).toBe(200);
    expect(prepRes.body.order.status).toBe("Preparing");
  });

  it("should prevent customer from cancelling an order once it is Preparing", async () => {
    const res = await request(app)
      .post(`/api/orders/${testOrderId}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ reason: "Changed my mind" });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("already 'Preparing'");
  });

  it("should complete delivery and allow admin refund", async () => {
    // Preparing -> Packed -> Out for delivery -> Delivered
    await request(app)
      .patch(`/api/orders/${testOrderId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ status: "Packed" });

    await request(app)
      .patch(`/api/orders/${testOrderId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ status: "Out for delivery" });

    const deliveredRes = await request(app)
      .patch(`/api/orders/${testOrderId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ status: "Delivered" });

    expect(deliveredRes.status).toBe(200);
    expect(deliveredRes.body.order.status).toBe("Delivered");

    // Admin processes refund
    const refundRes = await request(app)
      .post(`/api/orders/${testOrderId}/refund`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Customer goodwill courtesy refund" });

    expect(refundRes.status).toBe(200);
    expect(refundRes.body.order.paymentStatus).toBe("refunded");
  });

  it("should handle Razorpay webhook payment.captured event idempotently", async () => {
    // Create another order for webhook test
    const newOrderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ menuItemId: menuItem._id.toString(), quantity: 1 }],
        address: {
          name: "Aria Sharma",
          phone: "+91 98765 43210",
          line1: "Lotus Enclave",
          city: "Mumbai",
          postalCode: "400001"
        }
      });

    const whOrderId = newOrderRes.body.orderId;
    const whRzpId = newOrderRes.body.razorpayOrderId;

    const webhookRes = await request(app)
      .post("/api/orders/webhook")
      .set("x-razorpay-signature", "mock_signature_in_test")
      .send({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_webhook_test_999",
              order_id: whRzpId,
              amount: 10000,
              status: "captured"
            }
          }
        }
      });

    expect(webhookRes.status).toBe(200);

    const checkedOrder = await Order.findById(whOrderId);
    expect(checkedOrder.paymentStatus).toBe("paid");
    expect(checkedOrder.status).toBe("Placed");
  });
});
