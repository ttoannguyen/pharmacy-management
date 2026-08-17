import { randomUUID } from "node:crypto";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export type TimingPhase = "auth" | "membership" | "repository" | "serialize";

function readRequestId(request: Request) {
  const candidate = request.headers.get("x-request-id")?.trim();
  return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
}

export function createRequestObservability(request: Request) {
  const requestId = readRequestId(request);
  const timings = new Map<TimingPhase, number>();

  async function phase<T>(name: TimingPhase, operation: () => Promise<T>) {
    const startedAt = performance.now();
    try {
      return await operation();
    } finally {
      timings.set(name, (timings.get(name) ?? 0) + (performance.now() - startedAt));
    }
  }

  function phaseSync<T>(name: TimingPhase, operation: () => T) {
    const startedAt = performance.now();
    try {
      return operation();
    } finally {
      timings.set(name, (timings.get(name) ?? 0) + (performance.now() - startedAt));
    }
  }

  function finish(response: Response) {
    const serverTiming = [...timings.entries()]
      .map(([name, duration]) => `${name};dur=${duration.toFixed(1)}`)
      .join(", ");
    response.headers.set("x-request-id", requestId);
    if (serverTiming) response.headers.set("server-timing", serverTiming);

    // Keep logs structured and deliberately limited to non-sensitive request metadata.
    console.info(JSON.stringify({ event: "http_request", requestId, serverTiming }));
    return response;
  }

  return { requestId, phase, phaseSync, finish };
}
