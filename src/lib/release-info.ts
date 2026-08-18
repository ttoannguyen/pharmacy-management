import packageJson from "../../package.json";

export type ReleaseInfo = Readonly<{
  appVersion: string;
  activeVersion: string;
  commitSha: string | null;
  commitShort: string;
  branch: string;
  environment: string;
  provider: "vercel" | "local";
}>;

type ReleaseEnvironment = Record<string, string | undefined>;

const commitPattern = /^[0-9a-f]{7,40}$/i;
const labelPattern = /^[a-z0-9._/-]{1,100}$/i;
const environmentPattern = /^[a-z0-9_-]{1,32}$/i;

function validValue(value: string | undefined, pattern: RegExp) {
  const normalized = value?.trim();
  return normalized && pattern.test(normalized) ? normalized : null;
}

export function getReleaseInfo(environment: ReleaseEnvironment = process.env): ReleaseInfo {
  const commitSha = validValue(environment.VERCEL_GIT_COMMIT_SHA ?? environment.GIT_COMMIT_SHA, commitPattern)?.toLowerCase() ?? null;
  const commitShort = commitSha?.slice(0, 7) ?? "local";
  const branch = validValue(environment.VERCEL_GIT_COMMIT_REF ?? environment.GIT_BRANCH, labelPattern) ?? "local";
  const deploymentEnvironment = validValue(environment.VERCEL_ENV ?? environment.NODE_ENV, environmentPattern) ?? "local";

  return {
    appVersion: packageJson.version,
    activeVersion: `${packageJson.version}+${commitShort}`,
    commitSha,
    commitShort,
    branch,
    environment: deploymentEnvironment,
    provider: environment.VERCEL === "1" || commitSha !== null ? "vercel" : "local",
  };
}
