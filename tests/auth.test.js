import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import User from "../src/models/User.js";

describe("Authentication & User Authorization", () => {
  const timestamp = Date.now();
  const testCustomerEmail = `cust_${timestamp}@example.com`;
  const testStaffEmail = `staff_${timestamp}@example.com`;
  let customerToken = "";
  let adminToken = "";
  let staffUserId = "";

  beforeAll(async () => {
    // Login as seeded admin
    const adminRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@tastetrail.com", password: "TasteTrail@2026" });
    if (adminRes.status === 200) {
      adminToken = adminRes.body.token;
    }
  });

  it("should register a new customer successfully", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test Customer",
        email: testCustomerEmail,
        password: "Password123!",
        phone: "+91 99999 88888"
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user).toMatchObject({
      name: "Test Customer",
      email: testCustomerEmail,
      role: "customer",
      status: "active"
    });
    expect(res.body.user).not.toHaveProperty("passwordHash");
    customerToken = res.body.token;
  });

  it("should prevent duplicate customer registration", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Duplicate User",
        email: testCustomerEmail,
        password: "Password123!"
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("already exists");
  });

  it("should reject registration with invalid input", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "A",
        email: "not-an-email",
        password: "short"
      });

    expect(res.status).toBe(400);
  });

  it("should login registered customer and return valid token", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: testCustomerEmail,
        password: "Password123!"
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.email).toBe(testCustomerEmail);
  });

  it("should reject login with incorrect credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: testCustomerEmail,
        password: "WrongPassword999!"
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toContain("Incorrect");
  });

  it("should return profile for authenticated user", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testCustomerEmail);
  });

  it("should reject unauthenticated profile access", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("should update user profile", async () => {
    const res = await request(app)
      .put("/api/auth/profile")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        name: "Updated Customer Name",
        phone: "+91 88888 77777",
        address: { line1: "42 Park Street", city: "Bangalore", postalCode: "560001" }
      });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe("Updated Customer Name");
    expect(res.body.user.address.city).toBe("Bangalore");
  });

  it("should submit staff application as pending", async () => {
    const res = await request(app)
      .post("/api/auth/register-staff")
      .send({
        name: "Applicant Staff",
        email: testStaffEmail,
        password: "PasswordStaff123!"
      });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("staff");
    expect(res.body.user.status).toBe("pending");
    staffUserId = res.body.user.id;
  });

  it("should prevent pending staff from logging in before admin approval", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: testStaffEmail,
        password: "PasswordStaff123!"
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("pending administrator approval");
  });

  it("should allow admin to view and approve pending staff request", async () => {
    expect(adminToken).toBeTruthy();

    // Check staff requests
    const listRes = await request(app)
      .get("/api/users/staff-requests")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.requests.some(r => r.email === testStaffEmail)).toBe(true);

    // Approve staff
    const approveRes = await request(app)
      .patch(`/api/users/${staffUserId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "active" });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.user.status).toBe("active");

    // Now staff can login
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        email: testStaffEmail,
        password: "PasswordStaff123!"
      });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.role).toBe("staff");
  });

  it("should prevent customer from accessing admin user management", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });
});
