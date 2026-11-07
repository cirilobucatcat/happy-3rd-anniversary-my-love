import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: { setupFiles: ["./vitest.setup.ts"], environment: "jsdom", include: ["**/*.test.ts"], exclude: ["node_modules/**", ".next/**", "out/**"] },
});
