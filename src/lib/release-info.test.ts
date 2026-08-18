import { describe, expect, it } from "vitest";

import { getReleaseInfo } from "./release-info";

describe("getReleaseInfo", () => {
  it("builds an active version from trusted Vercel release metadata", () => {
    expect(getReleaseInfo({
      VERCEL: "1",
      VERCEL_ENV: "production",
      VERCEL_GIT_COMMIT_REF: "production",
      VERCEL_GIT_COMMIT_SHA: "F153237737B504CCA5D739831EAD8FDB5385A55A",
    })).toEqual({
      appVersion: "0.1.0",
      activeVersion: "0.1.0+f153237",
      commitSha: "f153237737b504cca5d739831ead8fdb5385a55a",
      commitShort: "f153237",
      branch: "production",
      environment: "production",
      provider: "vercel",
    });
  });

  it("has a deterministic local fallback", () => {
    expect(getReleaseInfo({ NODE_ENV: "test" })).toMatchObject({
      activeVersion: "0.1.0+local",
      commitSha: null,
      commitShort: "local",
      branch: "local",
      environment: "test",
      provider: "local",
    });
  });

  it("does not expose arbitrary environment values", () => {
    const release = getReleaseInfo({
      VERCEL_GIT_COMMIT_SHA: "not-a-sha secret",
      VERCEL_GIT_COMMIT_REF: "branch with spaces and secrets",
      VERCEL_ENV: "production;token=secret",
    });

    expect(release).toMatchObject({ commitSha: null, branch: "local", environment: "local" });
    expect(JSON.stringify(release)).not.toContain("secret");
  });
});
