import type { LocalUser } from "./auth-context";
import { requireSystemAdmin } from "./authorization";

export type SystemAdminOverview = {
  activeUsers: number;
  activeStores: number;
  registeredProducts: number;
  pendingCatalogSubmissions: number;
};

export interface SystemAdminOverviewRepository {
  readOverview(): Promise<SystemAdminOverview>;
}

export function getSystemAdminOverview(
  actor: LocalUser,
  repository: SystemAdminOverviewRepository,
) {
  requireSystemAdmin(actor);
  return repository.readOverview();
}
