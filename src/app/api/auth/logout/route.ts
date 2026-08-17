import { NextResponse } from "next/server";

import { revokeCurrentSession } from "@/modules/identity/application/session";
import { prisma } from "@/lib/prisma";

export async function POST() {
  await revokeCurrentSession(prisma);
  return NextResponse.json({ status: "success", data: null, message: "Đã đăng xuất.", code: "OK", timestamp: new Date().toISOString() });
}
