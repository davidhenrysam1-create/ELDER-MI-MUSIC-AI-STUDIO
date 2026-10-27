import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  esbuild: {
    // The Next.js tsconfig uses "jsx": "preserve"; tests need a real transform.
    jsx: "automatic",
  },
  test: {
    environment: "node",
    /*
     * The app ships in *open studio* mode (no sign-in screen). The test suite
     * describes the accounts system itself — sign-up, sessions, ownership,
     * suspension — so it runs with accounts switched on and the open-mode
     * behaviour is covered explicitly in `tests/open-studio.test.ts`.
     */
    env: { STUDIO_ACCOUNTS: "on" },
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    globals: false,
    reporters: ["default"],
  },
});
