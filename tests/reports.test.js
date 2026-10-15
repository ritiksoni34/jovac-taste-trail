import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("Admin Dashboard, Reports & Audit Logging", () => {
  let adminToken = "";
  let customerToken = "";

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

  it("should return executive KPIs and breakdown for admin", async () => {
    const res = await request(app)
      .get("/api/reports/overview")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("kpis");
    expect(res.body.kpis).toHaveProperty("totalCustomers");
    expect(res.body.kpis).toHaveProperty("totalRevenue");
    expect(res.body.kpis).toHaveProperty("activeStaff");
    expect(res.body).toHaveProperty("ordersByStatus");
    expect(res.body).toHaveProperty("reservationsByStatus");
  });

  it("should query recorded operational audit logs", async () => {
    const res = await request(app)
      .get("/api/reports/audit-logs")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.logs)).toBe(true);
    expect(res.body.logs.length).toBeGreaterThan(0);
    expect(res.body.logs[0]).toHaveProperty("action");
  });

  it("should reject customer access to executive reports and audit logs", async () => {
    const reportRes = await request(app)
      .get("/api/reports/overview")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(reportRes.status).toBe(403);

    const auditRes = await request(app)
      .get("/api/reports/audit-logs")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(auditRes.status).toBe(403);
  });
});
