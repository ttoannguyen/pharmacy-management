#!/usr/bin/env node
import "dotenv/config";

function describe(name, raw) {
  if (!raw) return { name, configured: false };
  const url = new URL(raw);
  const isPooler = url.hostname.includes("pooler") || url.searchParams.get("pgbouncer") === "true" || url.port === "6543";
  return {
    name,
    configured: true,
    host: url.hostname,
    port: url.port || "5432",
    pooler: isPooler,
    pgbouncer: url.searchParams.get("pgbouncer") === "true",
    mode: url.port === "6543" || url.searchParams.get("pgbouncer") === "true" ? "transaction-pooler" : (url.hostname.includes("pooler") ? "session-pooler" : "direct"),
    schema: url.searchParams.get("schema") ?? "public",
  };
}

const runtime = describe("DATABASE_URL", process.env.DATABASE_URL);
const migration = describe("DIRECT_URL", process.env.DIRECT_URL);
const errors = [];
if (!runtime.configured) errors.push("DATABASE_URL is missing.");
if (!migration.configured) errors.push("DIRECT_URL is missing.");
if (runtime.configured && !runtime.pooler) errors.push("DATABASE_URL does not look like a runtime pooler URL.");
if (migration.configured && migration.pooler && migration.mode !== "session-pooler" && migration.mode !== "direct") errors.push("DIRECT_URL must use session-pooler or direct mode.");

const report = { generatedAt: new Date().toISOString(), runtime, migration, valid: errors.length === 0, errors };
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
