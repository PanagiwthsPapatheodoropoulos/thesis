import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const forceExitReporter = {
  onFinished(files = [], errors = []) {
    let hasFailed = errors.length > 0;
    for (const file of files) {
      if (file.result?.state === "fail") {
        hasFailed = true;
      }
      if (file.tasks) {
        const checkTasks = (tasks) => {
          for (const task of tasks) {
            if (task.result?.state === "fail") {
              hasFailed = true;
            }
            if (task.tasks) {
              checkTasks(task.tasks);
            }
          }
        };
        checkTasks(file.tasks);
      }
    }
    setTimeout(() => {
      process.exit(hasFailed ? 1 : 0);
    }, 1000);
  },
};

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setupTests.ts"],
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 15000,
    hookTimeout: 15000,
    teardownTimeout: 10000,
    reporters: ["default", forceExitReporter],
    pool: "forks",
    poolOptions: {
      forks: {
        maxForks: 4,
        execArgv: ["--max-old-space-size=6144", "--expose-gc"],
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{js,jsx,ts,tsx}"],
      exclude: ["src/main.jsx", "src/main.tsx"],
    },
  },
});

