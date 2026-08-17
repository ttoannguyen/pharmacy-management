#!/usr/bin/env node

import { gzipSync } from "node:zlib";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const manifest = JSON.parse(await readFile(path.join(projectRoot, ".next/build-manifest.json"), "utf8"));
const staticRoot = path.join(projectRoot, ".next");
const files = [...new Set([...(manifest.rootMainFiles ?? []), ...(manifest.polyfillFiles ?? [])])]
  .filter((file) => file.endsWith(".js") || file.endsWith(".css"));

const assets = [];
for (const relativeFile of files) {
  const content = await readFile(path.join(staticRoot, relativeFile));
  assets.push({ file: relativeFile, bytes: content.byteLength, gzipBytes: gzipSync(content, { level: 9 }).byteLength });
}
const allChunkFiles = (await import("node:fs/promises")).readdir(path.join(staticRoot, "static/chunks"));
const queryClientChunks = [];
for (const file of await allChunkFiles) {
  if (!file.endsWith(".js")) continue;
  const content = await readFile(path.join(staticRoot, "static/chunks", file), "utf8");
  if (content.includes("QueryClient") || content.includes("react-query")) queryClientChunks.push(file);
}

const rootLayout = await readFile(path.join(projectRoot, "src/app/layout.tsx"), "utf8");
const dashboardLayout = await readFile(path.join(projectRoot, "src/app/dashboard/layout.tsx"), "utf8");
const report = {
  generatedAt: new Date().toISOString(),
  buildCommit: process.env.PERF_COMMIT ?? "working-tree",
  runtime: "Next.js production build / Turbopack",
  routeBoundary: {
    rootMountsQueryProvider: rootLayout.includes("AppProviders"),
    dashboardMountsQueryProvider: dashboardLayout.includes("AppProviders"),
  },
  rootMain: {
    assetCount: assets.length,
    bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
    gzipBytes: assets.reduce((sum, asset) => sum + asset.gzipBytes, 0),
  },
  queryClientChunks,
  assets,
  webVitals: { status: "not-measured", reason: "No browser trace/Playwright runner is configured in this repository." },
};

const output = process.env.PERF_OUTPUT ?? "docs/performance/perf-3.2-bundle.json";
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
