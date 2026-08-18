import { NextResponse } from "next/server";

import { getReleaseInfo } from "@/lib/release-info";

export function GET() {
  const release = getReleaseInfo();

  return NextResponse.json(
    {
      status: "ok",
      service: "pharmacy-management",
      activeVersion: release.activeVersion,
      release,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "cache-control": "no-store",
        "x-app-version": release.activeVersion,
        "x-release-commit": release.commitShort,
      },
    },
  );
}
