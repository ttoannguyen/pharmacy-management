import { z } from "zod";

const databaseEnvSchema = z.object({
  DATABASE_URL: z.url().startsWith("postgresql://"),
});

const authEnvSchema = z.object({
  AUTH_PEPPER: z.string().min(32),
});

export function getServerEnv() {
  return databaseEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
  });
}

export function getAuthEnv() {
  return authEnvSchema.parse({
    AUTH_PEPPER: process.env.AUTH_PEPPER,
  });
}
