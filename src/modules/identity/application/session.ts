import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import type { PrismaClient } from "@/generated/prisma/client";

const SESSION_TTL_SECONDS = 8 * 60 * 60;
const DEV_COOKIE_NAME = "pharmacy_session";
const PROD_COOKIE_NAME = "__Host-pharmacy_session";
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

type AuthSessionDatabase = Pick<PrismaClient, "authSession">;

export function getSessionCookieName() {
  return process.env.NODE_ENV === "production" ? PROD_COOKIE_NAME : DEV_COOKIE_NAME;
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function shouldTouchSession(lastUsedAt: Date, now = new Date()) {
  return lastUsedAt.getTime() < now.getTime() - SESSION_TOUCH_INTERVAL_MS;
}

export async function touchSessionBestEffort(
  db: AuthSessionDatabase,
  sessionId: string,
  lastUsedAt: Date,
) {
  if (!shouldTouchSession(lastUsedAt)) return false;

  try {
    await db.authSession.updateMany({
      where: { id: sessionId, lastUsedAt },
      data: { lastUsedAt: new Date() },
    });
    return true;
  } catch (error) {
    console.warn(JSON.stringify({ event: "session_touch_failed", sessionId, error: error instanceof Error ? error.name : "UnknownError" }));
    return false;
  }
}

export async function createSession(
  db: AuthSessionDatabase,
  userId: string,
  metadata?: { ipAddress?: string; userAgent?: string },
) {
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await db.authSession.create({
    data: {
      userId,
      tokenHash: hashSessionToken(rawToken),
      expiresAt,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent?.slice(0, 512),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieName(), rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });

  return expiresAt;
}

export async function getSessionToken() {
  return (await cookies()).get(getSessionCookieName())?.value ?? null;
}

export async function revokeCurrentSession(db: AuthSessionDatabase) {
  const token = await getSessionToken();

  if (token) {
    await db.authSession.updateMany({
      where: { tokenHash: hashSessionToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}
