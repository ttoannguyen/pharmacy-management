#!/usr/bin/env node

/**
 * Browser evidence runner for PERF-3.2 and PERF-3.4.
 *
 * Start a local production server separately and point it at a disposable,
 * deterministically seeded database. The report stores only paths, counts and
 * timings; credentials and cookies never leave this process.
 */
import { writeFile } from "node:fs/promises";
import { chromium, expect, firefox, webkit } from "@playwright/test";

const baseUrl = (process.env.PERF_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const baseOrigin = new URL(baseUrl).origin;
const host = new URL(baseUrl).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  throw new Error("Browser trace only accepts a local target.");
}

const email = process.env.PERF_EMAIL ?? "owner@demo.invalid";
const password = process.env.PERF_PASSWORD ?? "DemoPassword123!";
const output = process.env.PERF_OUTPUT ?? "docs/performance/perf-browser-local.json";
const browserName = process.env.PERF_BROWSER ?? "chromium";
const browserTypes = { chromium, firefox, webkit };
if (!browserTypes[browserName]) throw new Error("PERF_BROWSER must be chromium, firefox or webkit.");

const navigationSamples = Number(process.env.PERF_NAV_SAMPLES ?? 5);
if (!Number.isInteger(navigationSamples) || navigationSamples < 3 || navigationSamples > 20) {
  throw new Error("PERF_NAV_SAMPLES must be an integer between 3 and 20.");
}

const numberFormatter = new Intl.NumberFormat("vi-VN");
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function percentile(values, percentileValue) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return Number(sorted[index].toFixed(1));
}

function summarize(values) {
  return {
    n: values.length,
    p50Ms: percentile(values, 50),
    p90Ms: percentile(values, 90),
    p95Ms: percentile(values, 95),
    maxMs: Number(Math.max(...values).toFixed(1)),
  };
}

function isOverviewGet(response) {
  const url = new URL(response.url());
  return url.origin === baseOrigin
    && url.pathname === "/api/catalog/overview"
    && response.request().method() === "GET";
}

async function readOverview(response) {
  const body = await response.json();
  if (!response.ok() || !body?.data) {
    throw new Error(`Overview request failed with status ${response.status()}.`);
  }
  return body.data;
}

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
  let page = null;
  let createdProductId = null;
  let createdSkuId = null;
  let cleanup = { attempted: false, archived: false, status: null };

  try {
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

    page = await context.newPage();
    const requests = [];
    const requestRecords = new WeakMap();
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.origin !== baseOrigin) return;
      const record = {
        path: `${url.pathname}${url.search}`,
        method: request.method(),
        startedAt: performance.now(),
        status: null,
        failed: false,
      };
      requests.push(record);
      requestRecords.set(request, record);
    });
    page.on("response", (response) => {
      const record = requestRecords.get(response.request());
      if (record) record.status = response.status();
    });
    page.on("requestfinished", (request) => {
      const record = requestRecords.get(request);
      if (record) record.finishedAt = performance.now();
    });
    page.on("requestfailed", (request) => {
      const record = requestRecords.get(request);
      if (record) {
        record.failed = true;
        record.finishedAt = performance.now();
      }
    });

    const countOverviewRequests = (startIndex = 0) => requests
      .slice(startIndex)
      .filter((request) => request.path === "/api/catalog/overview" && request.method === "GET")
      .length;
    const countDashboardRscRequests = (startIndex = 0) => requests
      .slice(startIndex)
      .filter((request) => request.path.startsWith("/dashboard?_rsc=") && request.method === "GET")
      .length;
    const apiRequestsBetween = (startIndex, endIndex = requests.length) => requests
      .slice(startIndex, endIndex)
      .filter((request) => request.path.startsWith("/api/"))
      .map(({ path, method, status, failed }) => ({ path, method, status, failed }));
    const hasBoundedSkuMutationRefetch = (records, mutationPath, mutationMethod, detailPath) => {
      const mutations = records.filter((request) => request.path === mutationPath && request.method === mutationMethod);
      const reads = records.filter((request) => request.method === "GET");
      return mutations.length === 1
        && reads.length === 1
        && reads[0].path === detailPath
        && records.every((request) => !request.failed
          && request.status !== null
          && request.status >= 200
          && request.status < 400);
    };
    const skuMetric = () => page.locator("article.metric-card").filter({ hasText: "Quy cách / SKU" }).locator("strong");

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
    const directDashboardRequiresLogin = new URL(page.url()).pathname === "/auth/login";
    if (!directDashboardRequiresLogin) {
      throw new Error("Unauthenticated direct dashboard entry did not redirect to login.");
    }
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Mật khẩu").fill(password);
    const loginOverviewResponse = page.waitForResponse(isOverviewGet);
    await Promise.all([
      page.waitForURL("**/dashboard"),
      page.getByRole("button", { name: "Đăng nhập" }).click(),
    ]);
    await readOverview(await loginOverviewResponse);
    await page.waitForLoadState("networkidle");
    const dashboard = await readVitals(page);

    // Preserve PERF-3.2 route-level Web Vitals evidence with an isolated full
    // navigation. PERF-3.4 cache evidence starts after this measurement.
    await page.goto(`${baseUrl}/dashboard/catalog`, { waitUntil: "networkidle" });
    const catalog = await readVitals(page);

    const controlDurations = [];
    const controlOverviewRequests = [];
    let baselineOverview = null;
    let cacheSeededAt = null;

    // Full document navigation remounts QueryClientProvider. It is the controlled
    // baseline for the same build, dataset and browser profile.
    for (let sample = 0; sample < navigationSamples; sample += 1) {
      const startIndex = requests.length;
      const startedAt = performance.now();
      const overviewResponse = page.waitForResponse(isOverviewGet);
      await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
      baselineOverview = await readOverview(await overviewResponse);
      await expect(skuMetric()).toHaveText(numberFormatter.format(baselineOverview.skuCount));
      controlDurations.push(performance.now() - startedAt);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(800);
      controlOverviewRequests.push(countOverviewRequests(startIndex));
      cacheSeededAt = performance.now();
    }

    const warmDurations = [];
    const warmOverviewRequests = [];
    const warmDashboardRscPrefetchRequests = [];
    const warmDashboardRscRequestsOnClick = [];
    const cacheAges = [];
    let cachedValueVisibleOnEveryReturn = true;

    // These are real Next client transitions. The provider and QueryClient must
    // remain mounted from Dashboard -> Catalog -> Dashboard.
    for (let sample = 0; sample < navigationSamples; sample += 1) {
      const cycleStartIndex = requests.length;
      await Promise.all([
        page.waitForURL("**/dashboard/catalog"),
        page.getByRole("link", { name: "Danh mục thuốc" }).first().click(),
      ]);
      await page.getByRole("heading", { name: "Sản phẩm & quy cách bán" }).waitFor();

      const startIndex = requests.length;
      const startedAt = performance.now();
      await Promise.all([
        page.waitForURL("**/dashboard"),
        page.getByRole("link", { name: "Tổng quan", exact: true }).click(),
      ]);
      await expect(skuMetric()).toHaveText(numberFormatter.format(baselineOverview.skuCount));
      warmDurations.push(performance.now() - startedAt);
      cachedValueVisibleOnEveryReturn &&= await skuMetric().isVisible();
      await page.waitForLoadState("networkidle");
      warmOverviewRequests.push(countOverviewRequests(startIndex));
      const dashboardRscOnClick = countDashboardRscRequests(startIndex);
      warmDashboardRscRequestsOnClick.push(dashboardRscOnClick);
      warmDashboardRscPrefetchRequests.push(countDashboardRscRequests(cycleStartIndex) - dashboardRscOnClick);
      cacheAges.push(performance.now() - cacheSeededAt);
    }

    const controlDurationSummary = summarize(controlDurations);
    const warmDurationSummary = summarize(warmDurations);
    const returnNavigation = {
      controlFullReload: {
        durations: controlDurationSummary,
        samplesMs: controlDurations.map((value) => Number(value.toFixed(1))),
        overviewRequestsPerSample: controlOverviewRequests,
        totalOverviewRequests: controlOverviewRequests.reduce((sum, value) => sum + value, 0),
      },
      warmClientReturn: {
        durations: warmDurationSummary,
        samplesMs: warmDurations.map((value) => Number(value.toFixed(1))),
        overviewRequestsPerSample: warmOverviewRequests,
        totalOverviewRequests: warmOverviewRequests.reduce((sum, value) => sum + value, 0),
        dashboardRscPrefetchRequestsPerSample: warmDashboardRscPrefetchRequests,
        dashboardRscRequestsOnClickPerSample: warmDashboardRscRequestsOnClick,
        maxCacheAgeMs: Number(Math.max(...cacheAges).toFixed(1)),
        withinStaleTime: Math.max(...cacheAges) < 30_000,
        cachedValueVisibleOnEveryReturn,
      },
    };

    // Prove mutation convergence without remounting the provider. Add one SKU,
    // verify the old cached overview remains visible during a delayed refetch,
    // then verify the committed count arrives in one overview request.
    await Promise.all([
      page.waitForURL("**/dashboard/catalog"),
      page.getByRole("link", { name: "Danh mục thuốc" }).first().click(),
    ]);
    const productLink = page.locator(".product-title a").first();
    const productHref = await productLink.getAttribute("href");
    if (!productHref) throw new Error("Seeded catalog has no product detail link.");
    const productId = new URL(productHref, baseUrl).pathname.split("/").at(-1);
    if (!productId) throw new Error("Could not resolve the product ID from the catalog link.");
    createdProductId = productId;
    await Promise.all([
      page.waitForURL(`**/dashboard/catalog/${productId}`),
      productLink.click(),
    ]);

    const mutationStartIndex = requests.length;
    const newSkuCode = `BROWSER-PERF-${Date.now()}`;
    await page.getByRole("button", { name: /Thêm SKU/ }).click();
    await page.getByLabel(/Mã SKU/).fill(newSkuCode);
    await page.getByLabel(/Quy đổi về cơ sở/).fill("1");
    await page.getByLabel(/Giá bán/).fill("1000");
    const [skuResponse] = await Promise.all([
      page.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.origin === baseOrigin
          && url.pathname === `/api/catalog/products/${productId}/skus`
          && response.request().method() === "POST";
      }),
      page.getByRole("button", { name: "Lưu SKU" }).click(),
    ]);
    if (!skuResponse.ok()) throw new Error(`SKU creation failed with status ${skuResponse.status()}.`);
    const createdSku = await skuResponse.json();
    createdSkuId = createdSku?.data?.sku?.id ?? null;
    if (!createdSkuId) throw new Error("SKU creation response did not include an ID.");
    await expect(page.getByText(newSkuCode, { exact: true })).toBeVisible();
    const addMutationEndIndex = requests.length;
    const addMutationRequests = apiRequestsBetween(mutationStartIndex, addMutationEndIndex);

    let delayedOverviewRequest = false;
    await page.route("**/api/catalog/overview", async (route) => {
      if (!delayedOverviewRequest && route.request().method() === "GET") {
        delayedOverviewRequest = true;
        await sleep(1_500);
      }
      await route.continue();
    });

    const overviewRequestsBeforeMutationReturn = countOverviewRequests();
    const mutationOverviewResponse = page.waitForResponse(isOverviewGet);
    const mutationReturnStartedAt = performance.now();
    await Promise.all([
      page.waitForURL("**/dashboard"),
      page.getByRole("link", { name: "Tổng quan", exact: true }).click(),
    ]);
    await skuMetric().waitFor({ state: "visible" });
    const cachedValueDuringRefetch = (await skuMetric().textContent())?.trim() ?? null;
    const skeletonVisibleDuringRefetch = await page.locator("article.metric-card[aria-hidden='true']").count() > 0;
    const committedOverview = await readOverview(await mutationOverviewResponse);
    await expect(skuMetric()).toHaveText(numberFormatter.format(committedOverview.skuCount));
    const mutationReturnMs = performance.now() - mutationReturnStartedAt;
    const overviewRequestsAfterMutationReturn = countOverviewRequests();

    // Return through client navigation and exercise the missing E1.2 lifecycle
    // flow. Each mutation must produce only one active detail refetch; list and
    // overview stay invalidated without a sequential request waterfall.
    await Promise.all([
      page.waitForURL("**/dashboard/catalog"),
      page.getByRole("link", { name: "Danh mục thuốc" }).first().click(),
    ]);
    const lifecycleProductLink = page.locator(`a[href="/dashboard/catalog/${productId}"]`).first();
    await Promise.all([
      page.waitForURL(`**/dashboard/catalog/${productId}`),
      lifecycleProductLink.click(),
    ]);
    const createdSkuItem = page.locator(".sku-detail-item").filter({ hasText: newSkuCode });
    await expect(createdSkuItem).toBeVisible();

    const updateMutationStartIndex = requests.length;
    await createdSkuItem.getByRole("button", { name: `Sửa SKU ${newSkuCode}` }).click();
    await page.getByLabel(`Quy đổi mới của ${newSkuCode}`).fill("2");
    await page.getByLabel(`Giá bán mới của ${newSkuCode}`).fill("1500");
    await page.getByLabel(`Lý do sửa ${newSkuCode}`).fill("Browser performance update evidence");
    const [updateResponse] = await Promise.all([
      page.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.origin === baseOrigin
          && url.pathname === `/api/catalog/products/${productId}/skus/${createdSkuId}`
          && response.request().method() === "PUT";
      }),
      page.getByRole("button", { name: `Lưu thay đổi ${newSkuCode}` }).click(),
    ]);
    if (!updateResponse.ok()) throw new Error(`SKU update failed with status ${updateResponse.status()}.`);
    const updatedSkuBody = await updateResponse.json();
    const updatedSku = updatedSkuBody?.data?.sku ?? null;
    await expect(createdSkuItem).toContainText("1.500");
    const updateMutationEndIndex = requests.length;
    const updateMutationRequests = apiRequestsBetween(updateMutationStartIndex, updateMutationEndIndex);

    const archiveMutationStartIndex = requests.length;
    await createdSkuItem.getByRole("button", { name: `Ngừng bán ${newSkuCode}` }).click();
    await page.getByLabel(`Lý do ngừng bán ${newSkuCode}`).fill("Browser performance trace cleanup");
    const [archiveResponse] = await Promise.all([
      page.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.origin === baseOrigin
          && url.pathname === `/api/catalog/products/${productId}/skus/${createdSkuId}`
          && response.request().method() === "PATCH";
      }),
      page.getByRole("button", { name: `Xác nhận ngừng bán ${newSkuCode}` }).click(),
    ]);
    cleanup = { attempted: true, archived: archiveResponse.ok(), status: archiveResponse.status() };
    if (!archiveResponse.ok()) throw new Error(`SKU archive failed with status ${archiveResponse.status()}.`);
    await expect(createdSkuItem).toHaveCount(0);
    const archiveMutationEndIndex = requests.length;
    const archiveMutationRequests = apiRequestsBetween(archiveMutationStartIndex, archiveMutationEndIndex);

    const detailApiPath = `/api/catalog/products/${productId}`;
    const skuApiPath = `/api/catalog/products/${productId}/skus/${createdSkuId}`;
    const lifecycle = {
      add: { requests: addMutationRequests },
      update: {
        requests: updateMutationRequests,
        quantityInBaseUnit: updatedSku?.quantityInBaseUnit ?? null,
        sellingPriceMinor: updatedSku?.sellingPriceMinor ?? null,
      },
      archive: { requests: archiveMutationRequests, status: cleanup.status },
    };

    const mutation = {
      route: "/dashboard/catalog/[id]",
      productId,
      skuCountBefore: baselineOverview.skuCount,
      skuCountAfter: committedOverview.skuCount,
      cachedValueDuringRefetch,
      skeletonVisibleDuringRefetch,
      overviewRequestDelta: overviewRequestsAfterMutationReturn - overviewRequestsBeforeMutationReturn,
      returnAndConvergeMs: Number(mutationReturnMs.toFixed(1)),
      lifecycle,
      cleanup,
    };

    const criteria = {
      directDashboardStillRequiresAuthentication: directDashboardRequiresLogin,
      controlLoadsFetchOverviewExactlyOnce: controlOverviewRequests.every((count) => count === 1),
      warmReturnsStayWithinStaleTime: returnNavigation.warmClientReturn.withinStaleTime,
      warmReturnsUseCachedOverview: warmOverviewRequests.every((count) => count === 0)
        && cachedValueVisibleOnEveryReturn,
      warmReturnsUsePrefetchedDashboardRoute: warmDashboardRscRequestsOnClick.every((count) => count === 0),
      warmMedianIsFasterThanControl: warmDurationSummary.p50Ms < controlDurationSummary.p50Ms,
      mutationKeepsCachedValueDuringRefetch: cachedValueDuringRefetch === numberFormatter.format(baselineOverview.skuCount)
        && !skeletonVisibleDuringRefetch,
      mutationConvergesInOneOverviewRequest: mutation.overviewRequestDelta === 1
        && mutation.skuCountAfter === mutation.skuCountBefore + 1,
      skuAddAvoidsRefetchWaterfall: hasBoundedSkuMutationRefetch(
        addMutationRequests,
        `/api/catalog/products/${productId}/skus`,
        "POST",
        detailApiPath,
      ),
      skuUpdateAvoidsRefetchWaterfall: hasBoundedSkuMutationRefetch(
        updateMutationRequests,
        skuApiPath,
        "PUT",
        detailApiPath,
      ) && updatedSku?.quantityInBaseUnit === "2" && updatedSku?.sellingPriceMinor === "1500",
      skuArchiveAvoidsRefetchWaterfall: hasBoundedSkuMutationRefetch(
        archiveMutationRequests,
        skuApiPath,
        "PATCH",
        detailApiPath,
      ),
      mutationCleanupArchivedSku: cleanup.archived,
      noFailedApiRequests: requests
        .filter((request) => request.path.startsWith("/api/"))
        .every((request) => !request.failed
          && request.status !== null
          && request.status >= 200
          && request.status < 400),
    };

    const report = {
      generatedAt: new Date().toISOString(),
      stage: process.env.PERF_STAGE ?? "current",
      environment: process.env.PERF_ENVIRONMENT ?? "local",
      build: process.env.PERF_BUILD ?? "production",
      commit: process.env.GITHUB_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.PERF_COMMIT ?? "unknown",
      dataset: process.env.PERF_DATASET ?? "deterministic demo seed",
      runtimeRegion: process.env.PERF_RUNTIME_REGION ?? "local",
      databaseRegion: process.env.PERF_DATABASE_REGION ?? "local",
      baseUrl: baseOrigin,
      browser: browserName,
      viewport: { width: 1440, height: 900 },
      pages: { dashboard, catalog },
      returnNavigation,
      mutation,
      criteria,
    };
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const failures = Object.entries(criteria).filter(([, passed]) => !passed).map(([name]) => name);
    console.log(JSON.stringify({ output, returnNavigation, mutation, criteria }, null, 2));
    if (failures.length) throw new Error(`Browser performance criteria failed: ${failures.join(", ")}.`);
  } finally {
    if (createdSkuId && createdProductId && page && !cleanup.attempted) {
      try {
        cleanup = await page.evaluate(async ({ productId, skuId }) => {
          const response = await fetch(`/api/catalog/products/${productId}/skus/${skuId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: "Browser performance trace failure cleanup" }),
          });
          return { attempted: true, archived: response.ok, status: response.status };
        }, { productId: createdProductId, skuId: createdSkuId });
      } catch {
        cleanup = { attempted: true, archived: false, status: null };
      }
    }
    if (createdSkuId && !cleanup.archived) {
      console.error("Created browser fixture SKU could not be archived; dispose the test database.");
    }
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
