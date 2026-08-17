import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  globalIgnores([
    ".next/**",
    "out/**",
    "coverage/**",
    ".agents/**",
    ".codex/**",
    "src/generated/prisma/**",
    "next-env.d.ts",
  ]),
]);
