#!/usr/bin/env node

/** Read-only PostgreSQL telemetry snapshot for PERF-4.1. */
import "dotenv/config";
import { writeFile } from "node:fs/promises";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const url = new URL(connectionString);
if (process.env.PERF_ENVIRONMENT !== "local") {
  throw new Error("Set PERF_ENVIRONMENT=local for a telemetry snapshot.");
}
if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname) && process.env.PERF_ALLOW_REMOTE !== "1") {
  throw new Error("Refusing a remote telemetry target without PERF_ALLOW_REMOTE=1.");
}

const output = process.env.PERF_OUTPUT ?? "docs/performance/perf-4.1-db-telemetry.json";
const client = new pg.Client({ connectionString });
await client.connect();

try {
  const database = await client.query(`
      SELECT current_database() AS database,
             numbackends,
             xact_commit,
             xact_rollback,
             blks_read,
             blks_hit,
             deadlocks,
             temp_files,
             temp_bytes
      FROM pg_stat_database
      WHERE datname = current_database()
    `);
  const activity = await client.query(`
      SELECT state, wait_event_type, wait_event, count(*)::int AS sessions
      FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid()
      GROUP BY state, wait_event_type, wait_event
      ORDER BY sessions DESC
    `);
  const extension = await client.query("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') AS enabled");

  let slowQueries = [];
  if (extension.rows[0]?.enabled) {
    const result = await client.query(`
      SELECT queryid,
             calls,
             round(total_exec_time::numeric, 2) AS total_exec_time_ms,
             round(mean_exec_time::numeric, 2) AS mean_exec_time_ms,
             rows,
             shared_blks_hit,
             shared_blks_read
      FROM pg_stat_statements
      ORDER BY total_exec_time DESC
      LIMIT 20
    `);
    slowQueries = result.rows;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    environment: process.env.PERF_ENVIRONMENT,
    databaseHost: url.hostname,
    databasePort: url.port || "5432",
    database: database.rows[0] ?? null,
    activity: activity.rows,
    pgStatStatements: { enabled: Boolean(extension.rows[0]?.enabled), slowQueries },
    limitations: [
      "PostgreSQL statistics expose connection/wait/cache/statement evidence, not host CPU utilization.",
      "Query text is intentionally omitted to avoid storing sensitive SQL or parameters.",
    ],
  };
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ output, databaseHost: report.databaseHost, activity: report.activity, pgStatStatements: report.pgStatStatements.enabled }, null, 2));
} finally {
  await client.end();
}
