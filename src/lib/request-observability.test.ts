import { describe, expect, it, vi } from "vitest";

import { createRequestObservability } from "./request-observability";

describe("request observability", () => {
  it("preserves a safe request id and reports monotonic phase timings", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const telemetry = createRequestObservability(new Request("http://localhost/api", { headers: { "x-request-id": "req-123" } }));
    await telemetry.phase("auth", async () => "ok");
    const response = telemetry.finish(new Response(null, { status: 200 }));

    expect(response.headers.get("x-request-id")).toBe("req-123");
    expect(response.headers.get("server-timing")).toMatch(/^auth;dur=\d+\.\d$/);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"requestId":"req-123"'));
    log.mockRestore();
  });

  it("rejects unsafe ids and still adds an id to errors", () => {
    const telemetry = createRequestObservability(new Request("http://localhost/api", { headers: { "x-request-id": "bad id" } }));
    const response = telemetry.finish(new Response(JSON.stringify({ error: true }), { status: 500 }));

    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });
});
