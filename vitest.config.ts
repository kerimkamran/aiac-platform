import { defineConfig } from "vitest/config";
import path from "node:path";

// Design-execution-plan Phase 1 / T1.0 -- the project had no test runner at
// all (package.json only had dev/build/start/lint). Vitest, not Jest: no
// separate transform config needed for the TS/ESM setup Next.js already
// uses, and it's fast enough to run on every push alongside lint and build
// (see .github/workflows/ci.yml).
//
// Plain "node" environment by default -- most of what's worth unit-testing
// here is business logic (scoring, contrast math, reporting math), not
// component rendering. A test file can opt into jsdom per-file with a
// `// @vitest-environment jsdom` comment if a future test needs a DOM.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
