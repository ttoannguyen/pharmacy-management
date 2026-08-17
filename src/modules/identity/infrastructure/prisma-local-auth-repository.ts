import { createHmac } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";

import { getAuthEnv } from "@/lib/env";
import {
  InvalidCredentialsError,
  RateLimitedError,
} from "@/modules/identity/application/auth-errors";
import { dummyPasswordHash, verifyPassword } from "@/modules/identity/application/password";
import type { LocalUser } from "@/modules/identity/application/auth-context";

type LocalAuthDatabase = Pick<PrismaClient, "user" | "authLoginAttempt">;

const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashRateLimitKey(email: string, ipAddress: string) {
  const { AUTH_PEPPER } = getAuthEnv();
  return createHmac("sha256", AUTH_PEPPER)
    .update(`${normalizeEmail(email)}|${ipAddress}`)
    .digest("hex");
}

function secondsUntil(date: Date) {
  return Math.max(1, Math.ceil((date.getTime() - Date.now()) / 1000));
}

export class PrismaLocalAuthRepository {
  constructor(private readonly db: LocalAuthDatabase) {}

  async authenticate(email: string, password: string, ipAddress: string): Promise<LocalUser> {
    const normalizedEmail = normalizeEmail(email);
    const keyHash = hashRateLimitKey(normalizedEmail, ipAddress);
    const now = new Date();
    const attempt = await this.db.authLoginAttempt.findUnique({ where: { keyHash } });

    if (attempt?.lockedUntil && attempt.lockedUntil > now) {
      throw new RateLimitedError(secondsUntil(attempt.lockedUntil));
    }

    const user = await this.db.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        displayName: true,
        isActive: true,
        emailVerifiedAt: true,
        passwordHash: true,
      },
    });
    const passwordHash = user?.passwordHash ?? (await dummyPasswordHash);
    const passwordMatches = await verifyPassword(passwordHash, password);

    if (!user || !user.isActive || !passwordMatches) {
      await this.recordFailure(keyHash, user?.id, attempt, now);
      throw new InvalidCredentialsError();
    }

    await this.db.authLoginAttempt.deleteMany({ where: { keyHash } });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isActive: user.isActive,
      emailVerifiedAt: user.emailVerifiedAt,
    };
  }

  private async recordFailure(
    keyHash: string,
    userId: string | undefined,
    attempt: { failedCount: number; windowStart: Date } | null | undefined,
    now: Date,
  ) {
    const inWindow = attempt && now.getTime() - attempt.windowStart.getTime() < WINDOW_MS;
    const failedCount = inWindow ? attempt.failedCount + 1 : 1;
    const windowStart = inWindow ? attempt.windowStart : now;
    const lockedUntil = failedCount >= MAX_FAILURES ? new Date(now.getTime() + LOCK_MS) : null;

    await this.db.authLoginAttempt.upsert({
      where: { keyHash },
      update: { failedCount, windowStart, lockedUntil, userId },
      create: { keyHash, failedCount, windowStart, lockedUntil, userId },
    });
  }
}
