import { describe, expect, it, vi } from "vitest";

import { shouldTouchSession, touchSessionBestEffort } from "./session";

describe("deferred session touch", () => {
  it("touches only sessions outside the throttle interval", async () => {
    const now = new Date("2026-08-17T10:00:00Z");
    expect(shouldTouchSession(new Date("2026-08-17T09:59:00Z"), now)).toBe(false);
    expect(shouldTouchSession(new Date("2026-08-17T09:50:00Z"), now)).toBe(true);

    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    await expect(touchSessionBestEffort({ authSession: { updateMany } } as never, "session-1", new Date("2026-08-17T09:00:00Z"))).resolves.toBe(true);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it("does not propagate a failed best-effort touch", async () => {
    const updateMany = vi.fn().mockRejectedValue(new Error("pool unavailable"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(touchSessionBestEffort({ authSession: { updateMany } } as never, "session-1", new Date("2026-08-17T09:00:00Z"))).resolves.toBe(false);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("session_touch_failed"));
    warning.mockRestore();
  });
});
