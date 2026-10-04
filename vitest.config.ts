import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const obsidianStub = fileURLToPath(
  new URL("./test/obsidian-stub.ts", import.meta.url)
);

export default defineConfig({
  resolve: {
    alias: {
      obsidian: obsidianStub,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["test/setup.ts"],
    include: ["test/**/*.test.ts"],
    clearMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text", "html"],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
