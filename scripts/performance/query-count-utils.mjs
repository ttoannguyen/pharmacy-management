export function percentile(values, percentileValue) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1));
  return Number(sorted[index].toFixed(1));
}

export function summarizeLatencies(samples) {
  const successful = samples.filter((sample) => sample.ok).map((sample) => sample.latencyMs);
  const statusCounts = {};
  for (const sample of samples) {
    statusCounts[String(sample.status)] = (statusCounts[String(sample.status)] ?? 0) + 1;
  }
  return {
    n: samples.length,
    statusCounts,
    errorRate: Number(((samples.length - successful.length) / Math.max(1, samples.length)).toFixed(4)),
    p50Ms: percentile(successful, 50),
    p90Ms: percentile(successful, 90),
    p95Ms: percentile(successful, 95),
    maxMs: successful.length ? Number(Math.max(...successful).toFixed(1)) : null,
  };
}

export function evaluateSqlCallContract(samples, expectedSqlCalls) {
  const sqlCallsPerSample = samples.map((sample) => sample.sqlCalls);
  return {
    expectedSqlCalls,
    sqlCallsPerSample,
    passed: samples.length > 0
      && samples.every((sample) => sample.ok && sample.sqlCalls === expectedSqlCalls),
  };
}
