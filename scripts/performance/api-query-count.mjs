#!/usr/bin/env node

/**
 * Guarded current-state SQL call counter for PERF-1.2/PERF-2.1/PERF-2.3.
 *
 * Run a production server against a disposable PostgreSQL instance with
 * pg_stat_statements preloaded. Query text is used only inside PostgreSQL to
 * classify commands and is never written to the report.
 */
import "dotenv/config";

import { writeFile } from "node:fs/promises";
import pg from "pg";

import {
  evaluateSqlCallContract,
  summarizeLatencies,
} from "./query-count-utils.mjs";

const baseUrl = (process.env.PERF_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const base = new URL(baseUrl);
const databaseConnectionString = process.env.PERF_QUERY_COUNT_DATABASE_URL
  ?? process.env.DIRECT_URL
  ?? process.env.DATABASE_URL;
if (!databaseConnectionString) throw new Error("A disposable local PostgreSQL URL is required.");
const databaseUrl = new URL(databaseConnectionString);
const localHosts = ["localhost", "127.0.0.1", "::1"];
if (process.env.PERF_ENVIRONMENT !== "local-disposable") {
  throw new Error("PERF_ENVIRONMENT must be local-disposable.");
}
if (!localHosts.includes(base.hostname) || !localHosts.includes(databaseUrl.hostname)) {
  throw new Error("Query-count evidence only accepts local app and database targets.");
}

const sampleCount = Number(process.env.PERF_QUERY_COUNT_SAMPLES ?? 3);
if (!Number.isInteger(sampleCount) || sampleCount < 2 || sampleCount > 10) {
  throw new Error("PERF_QUERY_COUNT_SAMPLES must be an integer between 2 and 10.");
}

const email = process.env.PERF_EMAIL ?? "owner@demo.invalid";
const password = process.env.PERF_PASSWORD ?? "DemoPassword123!";
const productId = process.env.PERF_PRODUCT_ID ?? "80000000-0000-4000-8000-000000000001";
const output = process.env.PERF_OUTPUT ?? "docs/performance/perf-query-count-after-local.json";
const timeoutMs = Number(process.env.PERF_TIMEOUT_MS ?? 10_000);
const settleMs = Number(process.env.PERF_QUERY_COUNT_SETTLE_MS ?? 150);

const endpoints = [
  { name: "auth-me", path: "/api/auth/me", expectedSqlCalls: 1 },
  { name: "catalog-list", path: "/api/catalog/products?q=paracetamol&page=1&pageSize=20", expectedSqlCalls: 6 },
  { name: "catalog-list-with-total", path: "/api/catalog/products?q=paracetamol&page=1&pageSize=20&includeTotal=true", expectedSqlCalls: 7 },
  { name: "catalog-detail", path: `/api/catalog/products/${productId}`, expectedSqlCalls: 8 },
  { name: "catalog-overview", path: "/api/catalog/overview", expectedSqlCalls: 3 },
];

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "pharmacy-query-count" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Login failed with status ${response.status}.`);
  const cookie = (response.headers.getSetCookie?.() ?? [])
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  if (!cookie) throw new Error("Login succeeded without a session cookie.");
  return cookie;
}

async function requestEndpoint(path, cookie) {
  const startedAt = performance.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        cookie,
        "user-agent": "pharmacy-query-count",
        "x-request-id": `query-count-${crypto.randomUUID()}`,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const payloadBytes = (await response.arrayBuffer()).byteLength;
    return {
      ok: response.ok,
      status: response.status,
      latencyMs: performance.now() - startedAt,
      payloadBytes,
      serverTiming: response.headers.get("server-timing"),
    };
  } catch {
    return {
      ok: false,
      status: 0,
      latencyMs: performance.now() - startedAt,
      payloadBytes: null,
      serverTiming: null,
    };
  }
}

async function readStatementCounts(client) {
  const result = await client.query(`
    SELECT CASE
             WHEN query ~* '^\\s*SELECT' THEN 'SELECT'
             WHEN query ~* '^\\s*INSERT' THEN 'INSERT'
             WHEN query ~* '^\\s*UPDATE' THEN 'UPDATE'
             WHEN query ~* '^\\s*DELETE' THEN 'DELETE'
             ELSE 'OTHER'
           END AS command,
           SUM(calls)::bigint AS calls,
           SUM(rows)::bigint AS rows
    FROM pg_stat_statements
    WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
      AND userid = (SELECT usesysid FROM pg_user WHERE usename = current_user)
      AND query NOT ILIKE '%pg_stat_statements%'
    GROUP BY command
    ORDER BY command
  `);
  return result.rows.map((row) => ({
    command: row.command,
    calls: Number(row.calls),
    rows: Number(row.rows),
  }));
}

const telemetry = new pg.Client({ connectionString: databaseConnectionString });
await telemetry.connect();

try {
  const extension = await telemetry.query("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') AS enabled");
  if (!extension.rows[0]?.enabled) {
    throw new Error("pg_stat_statements must be preloaded and installed in the disposable database.");
  }

  const cookie = await login();
  for (const endpoint of endpoints) {
    const warmup = await requestEndpoint(endpoint.path, cookie);
    if (!warmup.ok) throw new Error(`${endpoint.name} warmup failed with status ${warmup.status}.`);
  }

  const results = [];
  for (const endpoint of endpoints) {
    const samples = [];
    for (let sample = 0; sample < sampleCount; sample += 1) {
      await telemetry.query("SELECT pg_stat_statements_reset()");
      const request = await requestEndpoint(endpoint.path, cookie);
      await sleep(settleMs);
      const commands = await readStatementCounts(telemetry);
      const sqlCalls = commands.reduce((sum, command) => sum + command.calls, 0);
      samples.push({ ...request, sqlCalls, commands });
    }
    results.push({
      endpoint: endpoint.name,
      path: endpoint.path,
      latency: summarizeLatencies(samples),
      queryContract: evaluateSqlCallContract(samples, endpoint.expectedSqlCalls),
      samples: samples.map((sample) => ({
        status: sample.status,
        latencyMs: Number(sample.latencyMs.toFixed(1)),
        payloadBytes: sample.payloadBytes,
        sqlCalls: sample.sqlCalls,
        commands: sample.commands,
        serverTiming: sample.serverTiming,
      })),
    });
  }

  const criteria = Object.fromEntries(results.map((result) => [
    `${result.endpoint}SqlCallContract`,
    result.queryContract.passed && result.latency.errorRate === 0,
  ]));
  const report = {
    evidenceProfile: process.env.PERF_EVIDENCE_PROFILE ?? "current-query-count-contract",
    generatedAt: new Date().toISOString(),
    environment: process.env.PERF_ENVIRONMENT,
    build: process.env.PERF_BUILD ?? "production",
    commit: process.env.GITHUB_SHA ?? process.env.PERF_COMMIT ?? "working-tree",
    dataset: process.env.PERF_DATASET ?? "deterministic demo seed",
    runtimeRegion: process.env.PERF_RUNTIME_REGION ?? "local",
    databaseRegion: process.env.PERF_DATABASE_REGION ?? "local",
    baseUrl: base.origin,
    databaseHost: databaseUrl.hostname,
    databasePort: databaseUrl.port || "5432",
    samplesPerEndpoint: sampleCount,
    results,
    criteria,
    limitations: [
      "This is current-state after evidence, not a reconstructed historical before profile.",
      "Query text and bound parameters are intentionally omitted from the report.",
      "Counts require an otherwise idle disposable database because pg_stat_statements is database/user scoped.",
    ],
  };
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ output, criteria, results: results.map(({ endpoint, latency, queryContract }) => ({ endpoint, latency, queryContract })) }, null, 2));

  const failed = Object.entries(criteria).filter(([, passed]) => !passed).map(([name]) => name);
  if (failed.length) throw new Error(`Query-count criteria failed: ${failed.join(", ")}.`);
} finally {
  await telemetry.end();
}
