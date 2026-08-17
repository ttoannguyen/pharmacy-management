import "dotenv/config";

import { defineConfig } from "prisma/config";

const directUrl = process.env.DIRECT_URL;
const isGenerateCommand = process.argv.includes("generate");

if (!directUrl && !isGenerateCommand) {
  throw new Error("DIRECT_URL is required for Prisma migration and admin commands.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // `prisma generate` only reads the schema and never connects. A local-only
    // placeholder lets clean CI/Vercel installs generate the client without
    // exposing the privileged migration connection to application runtime.
    url: directUrl ?? "postgresql://prisma:prisma@127.0.0.1:5432/prisma_generate_only",
  },
});
