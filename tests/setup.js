import "dotenv/config";
import { beforeAll, afterAll } from "vitest";
import { connectDB, disconnectDB } from "../src/config/db.js";

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    process.env.JWT_SECRET = "super_secure_test_secret_with_more_than_32_characters_length";
  }
  await connectDB();
});

afterAll(async () => {
  await disconnectDB();
});
