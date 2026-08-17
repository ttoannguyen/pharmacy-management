import { NextResponse } from "next/server";
import { z } from "zod";

import { createSession } from "@/modules/identity/application/session";
import { InvalidCredentialsError, RateLimitedError } from "@/modules/identity/application/auth-errors";
import { PrismaLocalAuthRepository } from "@/modules/identity/infrastructure/prisma-local-auth-repository";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({ email: z.email(), password: z.string().min(12).max(256) });

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", data: null, message: "Email hoặc mật khẩu không hợp lệ.", code: "INVALID_INPUT", timestamp: new Date().toISOString() }, { status: 422 });
  }

  try {
    const ipAddress = clientIp(request);
    const user = await new PrismaLocalAuthRepository(prisma).authenticate(parsed.data.email, parsed.data.password, ipAddress);
    const expiresAt = await createSession(prisma, user.id, { ipAddress, userAgent: request.headers.get("user-agent") ?? undefined });
    return NextResponse.json({ status: "success", data: { user, expiresAt: expiresAt.toISOString() }, message: "Đăng nhập thành công.", code: "OK", timestamp: new Date().toISOString() });
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return NextResponse.json({ status: "error", data: null, message: error.message, code: error.code, timestamp: new Date().toISOString() }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    }
    if (error instanceof InvalidCredentialsError) {
      return NextResponse.json({ status: "error", data: null, message: error.message, code: error.code, timestamp: new Date().toISOString() }, { status: 401 });
    }
    return NextResponse.json({ status: "error", data: null, message: "Authentication service is unavailable.", code: "AUTH_UNAVAILABLE", timestamp: new Date().toISOString() }, { status: 503 });
  }
}
