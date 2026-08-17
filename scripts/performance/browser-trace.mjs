#!/usr/bin/env node

/**
 * Browser evidence runner for the performance plan.
 * Start a local production server separately and provide a disposable seeded DB.
 * The report intentionally stores paths/timings only; cookies and credentials
 * never leave the process.
 */
import { writeFile } from "node:fs/promises";
import { chromium, firefox, webkit } from "@playwright/test";

const baseUrl = (process.env.PERF_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const host = new URL(baseUrl).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  throw new Error("Browser trace only accepts a local target.");
}

const email = process.env.PERF_EMAIL ?? "owner@demo.invalid";
const password = process.env.PERF_PASSWORD ?? "DemoPassword123!";
const output = process.env.PERF_OUTPUT ?? "docs/performance/perf-3.2-browser.json";
const browserName = process.env.PERF_BROWSER ?? "chromium";
const browserTypes = { chromium, firefox, webkit };
if (!browserTypes[browserName]) throw new Error("PERF_BROWSER must be chromium, firefox or webkit.");

async function readVitals(page) {
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const state = window.__pharmacyPerformance ?? {};
    return {
      navigationMs: navigation ? Number(navigation.duration.toFixed(1)) : null,
      domContentLoadedMs: navigation ? Number(navigation.domContentLoadedEventEnd.toFixed(1)) : null,
      loadMs: navigation ? Number(navigation.loadEventEnd.toFixed(1)) : null,
      lcpMs: state.lcp ?? null,
      cls: state.cls ?? 0,
      inpMs: state.inp ?? null,
    };
  });
}

async function main() {
  const browser = await browserTypes[browserName].launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    const state = { lcp: null, cls: 0, inp: null };
    window.__pharmacyPerformance = state;
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length) state.lcp = Math.round(entries.at(-1).startTime * 10) / 10;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        state.cls = Math.round(list.getEntries().filter((entry) => !entry.hadRecentInput).reduce((sum, entry) => sum + entry.value, 0) * 1000) / 1000;
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length) state.inp = Math.round(Math.max(...entries.map((entry) => entry.duration)) * 10) / 10;
      }).observe({ type: "event", buffered: true, durationThreshold: 16 });
    } catch {
      // Unsupported observers are represented as null in the report.
    }
  });

  const page = await context.newPage();
  const requests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === baseUrl) requests.push({ path: `${url.pathname}${url.search}`, method: request.method(), startedAt: performance.now() });
  });
  page.on("requestfinished", (request) => {
    const found = [...requests].reverse().find((entry) => entry.path === `${new URL(request.url()).pathname}${new URL(request.url()).search}` && !entry.finishedAt);
    if (found) found.finishedAt = performance.now();
  });

  await page.goto(`${baseUrl}/auth/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(password);
  await Promise.all([
    page.waitForURL("**/dashboard"),
    page.getByRole("button", { name: "Đăng nhập" }).click(),
  ]);
  await page.waitForLoadState("networkidle");
  const dashboard = await readVitals(page);

  await page.goto(`${baseUrl}/dashboard/catalog`, { waitUntil: "networkidle" });
  const catalog = await readVitals(page);

  // Exercise the real client-side route transition. A full page.goto would
  // remount QueryClientProvider and could not prove return-navigation caching.
  const overviewRequestsBeforeReturn = requests.filter((request) => request.path === "/api/catalog/overview").length;
  await Promise.all([
    page.waitForURL("**/dashboard"),
    page.getByRole("link", { name: "Tổng quan" }).click(),
  ]);
  await page.waitForLoadState("networkidle");
  const overviewRequestsAfterReturn = requests.filter((request) => request.path === "/api/catalog/overview").length;
  const dashboardReturn = {
    overviewRequestsBefore: overviewRequestsBeforeReturn,
    overviewRequestsAfter: overviewRequestsAfterReturn,
    overviewRefetched: overviewRequestsAfterReturn > overviewRequestsBeforeReturn,
  };

  const catalogRequestsBeforeMutation = requests.filter((request) => request.path.startsWith("/api/catalog/")).length;
  await page.goto(`${baseUrl}/dashboard/catalog/80000000-0000-4000-8000-000000000001`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Thêm SKU/ }).click();
  await page.getByLabel(/Mã SKU/).fill(`BROWSER-PERF-${Date.now()}`);
  await page.getByLabel(/Quy đổi về cơ sở/).fill("1");
  await page.getByLabel(/Giá bán/).fill("1000");
  const [skuResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/catalog/products/") && response.request().method() === "POST"),
    page.getByRole("button", { name: "Lưu SKU" }).click(),
  ]);
  const createdSku = await skuResponse.json();
  const createdSkuId = createdSku?.data?.sku?.id;
  if (createdSkuId) {
    await page.evaluate(async (skuId) => {
      const response = await fetch(`/api/catalog/products/80000000-0000-4000-8000-000000000001/skus/${skuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Browser performance trace cleanup" }),
      });
      if (!response.ok) throw new Error(`SKU archive failed: ${response.status}`);
    }, createdSkuId);
  }
  await page.waitForTimeout(250);
  const catalogRequestsAfterMutation = requests.filter((request) => request.path.startsWith("/api/catalog/")).length;

  const report = {
    generatedAt: new Date().toISOString(),
    environment: process.env.PERF_ENVIRONMENT ?? "local",
    baseUrl: new URL(baseUrl).origin,
    browser: browserName,
    viewport: { width: 1440, height: 900 },
    pages: { dashboard, catalog, dashboardReturn },
    mutation: {
      route: "/dashboard/catalog/[id]",
      requestCountBefore: catalogRequestsBeforeMutation,
      requestCountAfter: catalogRequestsAfterMutation,
      postMutationRequests: requests.slice(-8).map(({ path, method }) => ({ path, method })),
      archiveTested: Boolean(createdSkuId),
    },
  };
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await browser.close();
  console.log(JSON.stringify({ output, pages: report.pages, mutation: report.mutation }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
