import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2022",
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
    },
    environment: "node",
  },
});
