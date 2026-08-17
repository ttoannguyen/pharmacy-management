import { describe, expect, it } from "vitest";

import {
  evaluateSqlCallContract,
  percentile,
  summarizeLatencies,
} from "./query-count-utils.mjs";

describe("performance query-count utilities", () => {
  it("uses nearest-rank percentiles and excludes failed requests from latency", () => {
    const samples = [
      { ok: true, status: 200, latencyMs: 10 },
      { ok: true, status: 200, latencyMs: 20 },
      { ok: false, status: 503, latencyMs: 1 },
    ];

    expect(percentile([10, 20], 95)).toBe(20);
    expect(summarizeLatencies(samples)).toEqual({
      n: 3,
      statusCounts: { "200": 2, "503": 1 },
      errorRate: 0.3333,
      p50Ms: 10,
      p90Ms: 20,
      p95Ms: 20,
      maxMs: 20,
    });
  });

  it("fails the contract when any successful sample adds a SQL call", () => {
    const stable = [
      { ok: true, sqlCalls: 2 },
      { ok: true, sqlCalls: 2 },
    ];
    const regression = [...stable, { ok: true, sqlCalls: 3 }];

    expect(evaluateSqlCallContract(stable, 2).passed).toBe(true);
    expect(evaluateSqlCallContract(regression, 2)).toMatchObject({
      passed: false,
      sqlCallsPerSample: [2, 2, 3],
    });
  });
});
