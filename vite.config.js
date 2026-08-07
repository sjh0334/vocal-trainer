import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2022",
  },
  test: {
    include: ["tests/unit/**/*.test.js", "tests/integration/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
    },
    environment: "node",
  },
});
