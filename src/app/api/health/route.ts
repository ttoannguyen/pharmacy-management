import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "pharmacy-management",
    timestamp: new Date().toISOString(),
  });
}
