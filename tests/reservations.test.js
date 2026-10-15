import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import DiningTable from "../src/models/DiningTable.js";

describe("Table Reservations & Concurrency Safety", () => {
  let customerToken = "";
  let otherCustomerToken = "";
  let sampleTable = null;
  let testReservationId = "";

  // Pick a future date (e.g. 7 days from now)
  const targetDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const targetTime = "19:00";

  beforeAll(async () => {
    // 1. Customer login
    const custRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer@tastetrail.com", password: "TasteTrail@2026" });
    customerToken = custRes.body.token;

    // 2. Second customer login
    const otherRes = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Reservation Contestant",
        email: `contestant_${Date.now()}@example.com`,
        password: "Password123!"
      });
    otherCustomerToken = otherRes.body.token;

    // 3. Find a sample table (Cozy Duo or Signature Quartet)
    sampleTable = await DiningTable.findOne({ capacity: 2, isActive: true });
  });

  it("should list all 40 configured dining tables", async () => {
    const res = await request(app).get("/api/reservations/tables");
    expect(res.status).toBe(200);
    expect(res.body.tables.length).toBe(40);
  });

  it("should check table availability for a valid future slot", async () => {
    const res = await request(app)
      .get("/api/reservations/availability")
      .query({
        date: targetDate,
        time: targetTime,
        durationMinutes: 120,
        guests: 2
      });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tables)).toBe(true);
    const tableEntry = res.body.tables.find(t => t.id === sampleTable._id.toString());
    expect(tableEntry).toBeTruthy();
    expect(tableEntry.available).toBe(true);
  });

  it("should reject reservation requests outside restaurant operating hours", async () => {
    const res = await request(app)
      .get("/api/reservations/availability")
      .query({
        date: targetDate,
        time: "03:00", // 3 AM is closed
        durationMinutes: 120,
        guests: 2
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("opening hours");
  });

  it("should successfully reserve an available table", async () => {
    const res = await request(app)
      .post("/api/reservations")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        name: "Aria Sharma",
        email: "customer@tastetrail.com",
        date: targetDate,
        time: targetTime,
        durationMinutes: 120,
        guests: 2,
        tableId: sampleTable._id.toString(),
        notes: "Anniversary dinner by the window"
      });

    expect(res.status).toBe(201);
    expect(res.body.reservation.tableName).toBe(sampleTable.name);
    expect(res.body.reservation.status).toBe("Confirmed");
    testReservationId = res.body.reservation._id;
  });

  it("should reject double-booking on the same table for overlapping time", async () => {
    // Other customer tries to book the exact same table for 19:30 (overlaps with 19:00 - 21:00)
    const res = await request(app)
      .post("/api/reservations")
      .set("Authorization", `Bearer ${otherCustomerToken}`)
      .send({
        name: "Second Customer",
        email: "contestant@example.com",
        date: targetDate,
        time: "19:30",
        durationMinutes: 120,
        guests: 2,
        tableId: sampleTable._id.toString()
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("not available");
  });

  it("should list customer's active reservations", async () => {
    const res = await request(app)
      .get("/api/reservations/mine")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.reservations.some(r => r._id === testReservationId)).toBe(true);
  });

  it("should allow customer to cancel their reservation and release the table", async () => {
    const cancelRes = await request(app)
      .post(`/api/reservations/${testReservationId}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.reservation.status).toBe("Cancelled");

    // The table should now be available again for that time slot
    const checkRes = await request(app)
      .get("/api/reservations/availability")
      .query({
        date: targetDate,
        time: targetTime,
        durationMinutes: 120,
        guests: 2
      });

    expect(checkRes.status).toBe(200);
    const tableEntry = checkRes.body.tables.find(t => t.id === sampleTable._id.toString());
    expect(tableEntry.available).toBe(true);
  });
});
