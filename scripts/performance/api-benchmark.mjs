#!/usr/bin/env node

/**
 * Read-only API benchmark. Start `npm run start` separately after a production
 * build. It intentionally refuses non-local hosts unless PERF_ALLOW_REMOTE=1.
 */
import { writeFile } from "node:fs/promises";

const baseUrl = (process.env.PERF_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const host = new URL(baseUrl).hostname;
if (!['localhost', '127.0.0.1', '::1'].includes(host) && process.env.PERF_ALLOW_REMOTE !== "1") {
  throw new Error("Refusing non-local benchmark target. Set PERF_ALLOW_REMOTE=1 only for an approved synthetic environment.");
}
if (process.env.PERF_ENVIRONMENT !== "local" && process.env.PERF_ALLOW_REMOTE !== "1") {
  throw new Error("Set PERF_ENVIRONMENT=local (or explicitly approve a remote synthetic environment).");
}

const email = process.env.PERF_EMAIL ?? "owner@demo.invalid";
const password = process.env.PERF_PASSWORD ?? "DemoPassword123!";
const productId = process.env.PERF_PRODUCT_ID ?? "80000000-0000-4000-8000-000000000001";
const samples = Number(process.env.PERF_SAMPLES ?? 10);
const warmup = Number(process.env.PERF_WARMUP ?? 2);
const timeoutMs = Number(process.env.PERF_TIMEOUT_MS ?? 10_000);
const profiles = [1, 5, 20];

function percentile(values, percentile) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentile / 100) * sorted.length) - 1);
  return Number(sorted[index].toFixed(1));
}

function metric(results, concurrency) {
  const successful = results.filter((result) => result.ok).map((result) => result.ms);
  const payloads = results.filter((result) => result.ok && result.payloadBytes != null).map((result) => result.payloadBytes);
  return {
    concurrency,
    n: results.length,
    statusCounts: Object.fromEntries(Object.entries(Object.groupBy(results, (result) => String(result.status))).map(([status, rows]) => [status, rows.length])),
    errorRate: Number(((results.length - successful.length) / Math.max(1, results.length)).toFixed(4)),
    p50: percentile(successful, 50),
    p90: percentile(successful, 90),
    p95: percentile(successful, 95),
    max: successful.length ? Number(Math.max(...successful).toFixed(1)) : null,
    payloadBytes: payloads.length ? { p50: percentile(payloads, 50), max: Math.max(...payloads) } : null,
    serverTimingSamples: results.slice(0, 3).map((result) => result.serverTiming).filter(Boolean),
  };
}

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "pharmacy-performance-benchmark" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Login failed with status ${response.status}.`);
  const cookies = response.headers.getSetCookie?.() ?? [];
  const cookie = cookies.map((value) => value.split(";", 1)[0]).join("; ");
  if (!cookie) throw new Error("Login succeeded but no session cookie was returned.");
  return cookie;
}

async function request(path, cookie) {
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, { headers: { cookie, "x-request-id": `perf-${crypto.randomUUID()}` }, signal: AbortSignal.timeout(timeoutMs) });
    const payloadBytes = (await response.arrayBuffer()).byteLength;
    return { ok: response.ok, status: response.status, ms: performance.now() - started, payloadBytes, serverTiming: response.headers.get("server-timing") };
  } catch {
    return { ok: false, status: 0, ms: performance.now() - started, serverTiming: null };
  }
}

async function runEndpoint(name, path, cookie) {
  const results = [];
  for (const concurrency of profiles) {
    for (let i = 0; i < warmup; i += 1) await Promise.all(Array.from({ length: concurrency }, () => request(path, cookie)));
    const measured = [];
    for (let i = 0; i < samples; i += 1) measured.push(...await Promise.all(Array.from({ length: concurrency }, () => request(path, cookie))));
    results.push({ endpoint: name, ...metric(measured, concurrency) });
  }
  return results;
}

const cookie = await login();
const report = {
  generatedAt: new Date().toISOString(),
  environment: process.env.PERF_ENVIRONMENT,
  baseUrl: new URL(baseUrl).origin,
  runtimeRegion: process.env.PERF_RUNTIME_REGION ?? "unknown-local",
  databaseRegion: process.env.PERF_DATABASE_REGION ?? "unknown-local",
  buildCommit: process.env.PERF_COMMIT ?? "working-tree",
  node: process.version,
  dataset: process.env.PERF_DATASET ?? "existing synthetic demo dataset",
  samplesPerProfile: samples,
  warmupPerProfile: warmup,
  endpoints: [
    ...(await runEndpoint("auth-me", "/api/auth/me", cookie)),
    ...(await runEndpoint("catalog-list", "/api/catalog/products?q=paracetamol&page=1&pageSize=20", cookie)),
    ...(await runEndpoint("catalog-detail", `/api/catalog/products/${productId}`, cookie)),
    ...(await runEndpoint("catalog-overview", "/api/catalog/overview", cookie)),
  ],
};

const output = process.env.PERF_OUTPUT ?? "docs/performance/perf-0.2-local.json";
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output, environment: report.environment, endpoints: report.endpoints }, null, 2));
