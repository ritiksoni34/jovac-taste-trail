import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 20000,
    threads: false, // run sequentially to avoid database race conditions
    setupFiles: ["./tests/setup.js"]
  }
});
