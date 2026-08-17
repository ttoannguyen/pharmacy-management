import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";

import { PrismaClient, SystemRole } from "../../src/generated/prisma/client";
import { hashPassword } from "../../src/modules/identity/application/password";

const inputSchema = z.object({
  directUrl: z.url().startsWith("postgresql://"),
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(16).max(256),
  displayName: z.string().trim().min(1).max(120).default("System Administrator"),
});

const input = inputSchema.parse({
  directUrl: process.env.DIRECT_URL,
  email: process.env.SYSTEM_ADMIN_EMAIL,
  password: process.env.SYSTEM_ADMIN_PASSWORD,
  displayName: process.env.SYSTEM_ADMIN_DISPLAY_NAME,
});

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: input.directUrl }) });

async function main() {
  const passwordHash = await hashPassword(input.password);

  const userId = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email: input.email },
      select: { id: true, systemRole: true, isActive: true },
    });

    const user = await tx.user.upsert({
      where: { email: input.email },
      update: {
        displayName: input.displayName,
        passwordHash,
        emailVerifiedAt: new Date(),
        isActive: true,
        systemRole: SystemRole.SYSTEM_ADMIN,
      },
      create: {
        email: input.email,
        displayName: input.displayName,
        passwordHash,
        emailVerifiedAt: new Date(),
        systemRole: SystemRole.SYSTEM_ADMIN,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: existing ? "SYSTEM_ADMIN_BOOTSTRAPPED" : "SYSTEM_ADMIN_CREATED",
        targetType: "User",
        targetId: user.id,
        reason: "Explicit system administrator bootstrap command.",
        before: existing ? { systemRole: existing.systemRole, isActive: existing.isActive } : undefined,
        after: { systemRole: user.systemRole, isActive: user.isActive },
        metadata: { source: "bootstrap-system-admin" },
      },
    });

    return user.id;
  });

  console.info(JSON.stringify({ event: "system_admin_bootstrapped", userId }));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "System admin bootstrap failed.");
    process.exitCode = 1;
  });
