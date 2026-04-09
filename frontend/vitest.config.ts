import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./test/setup.ts"],
    css: false,
    include: [
      "components/**/*.test.{ts,tsx}",
      "hooks/**/*.test.{ts,tsx}",
      "lib/**/*.test.{ts,tsx}",
      "middlewares/**/*.test.{ts,tsx}",
    ],
    exclude: ["node_modules/**", "test/integration/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
