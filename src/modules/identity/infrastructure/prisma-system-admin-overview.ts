import type { PrismaClient } from "@/generated/prisma/client";

import type {
  SystemAdminOverviewRepository,
} from "@/modules/identity/application/system-admin";

type SystemAdminDatabase = Pick<
  PrismaClient,
  "user" | "store" | "registeredProduct" | "catalogSubmission"
>;

export class PrismaSystemAdminOverviewRepository implements SystemAdminOverviewRepository {
  constructor(private readonly db: SystemAdminDatabase) {}

  async readOverview() {
    const [activeUsers, activeStores, registeredProducts, pendingCatalogSubmissions] = await Promise.all([
      this.db.user.count({ where: { isActive: true } }),
      this.db.store.count({ where: { isActive: true } }),
      this.db.registeredProduct.count(),
      this.db.catalogSubmission.count({ where: { status: "PENDING" } }),
    ]);

    return { activeUsers, activeStores, registeredProducts, pendingCatalogSubmissions };
  }
}
