#!/usr/bin/env node
import "dotenv/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const target = process.env.MIGRATION_TEST_DATABASE_URL;
if (!target) {
  throw new Error("Set MIGRATION_TEST_DATABASE_URL to an explicitly provisioned empty PostgreSQL database; refusing to use DATABASE_URL.");
}

const url = new URL(target);
if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) && process.env.PERF_ALLOW_REMOTE !== "1") {
  throw new Error("Refusing a remote migration test database without PERF_ALLOW_REMOTE=1.");
}

const env = { ...process.env, DATABASE_URL: target, DIRECT_URL: target };
const { stdout, stderr } = await execFileAsync("npx", ["prisma", "migrate", "deploy"], { env, maxBuffer: 2 * 1024 * 1024 });
console.log(JSON.stringify({ status: "passed", host: url.hostname, port: url.port || "5432", output: `${stdout}${stderr}`.trim() }, null, 2));
