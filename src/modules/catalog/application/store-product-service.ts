import { z } from "zod";

import type { StoreContext } from "@/modules/identity/application/store-context";
import { requirePermission, requireStoreAccess } from "@/modules/identity/application/authorization";

export const storeProductInputSchema = z.object({
  storeId: z.uuid(),
  displayName: z.string().trim().min(1).max(240),
  baseUnitId: z.uuid(),
  shelfLocation: z.string().trim().max(120).optional(),
  minimumStockBase: z.number().finite().nonnegative().default(0),
  registeredProductId: z.uuid().optional(),
  basedOnGlobalVersion: z.number().int().positive().optional(),
  overrides: z.record(z.string(), z.unknown()).optional(),
  sku: z.object({
    code: z.string().trim().min(1).max(80),
    barcode: z.string().trim().max(80).optional(),
    productPackageId: z.uuid().optional(),
    unitId: z.uuid(),
    quantityInBaseUnit: z.number().finite().positive(),
    sellingPriceMinor: z.number().int().nonnegative().safe(),
  }).optional(),
});

export const storeProductOverrideSchema = z.object({
  displayName: z.string().trim().min(1).max(240).optional(),
  shelfLocation: z.string().trim().max(120).nullable().optional(),
  overrides: z.record(z.string(), z.unknown()).optional(),
}).refine((input) => input.displayName !== undefined || input.shelfLocation !== undefined || input.overrides !== undefined, {
  message: "At least one explicit override is required.",
});

export const addStoreSkuSchema = z.object({
  code: z.string().trim().min(1).max(80),
  barcode: z.string().trim().max(80).optional(),
  productPackageId: z.uuid().optional(),
  unitId: z.uuid(),
  quantityInBaseUnit: z.number().finite().positive(),
  sellingPriceMinor: z.number().int().nonnegative().safe(),
});

export const archiveStoreSkuSchema = z.object({
  reason: z.string().trim().min(1).max(240).optional(),
});

export type StoreProductInput = z.infer<typeof storeProductInputSchema>;
export type StoreProductOverrideInput = z.infer<typeof storeProductOverrideSchema>;
export type AddStoreSkuInput = z.infer<typeof addStoreSkuSchema>;
export type ArchiveStoreSkuInput = z.infer<typeof archiveStoreSkuSchema>;

export class CatalogValidationError extends Error {
  readonly code = "CATALOG_VALIDATION_ERROR";
}

export class GlobalCatalogLinkError extends Error {
  readonly code = "GLOBAL_CATALOG_LINK_ERROR";
}

export class CatalogConflictError extends Error {
  readonly code = "CATALOG_CONFLICT";
}

export class CatalogNotFoundError extends Error {
  readonly code = "CATALOG_NOT_FOUND";
}

export function normalizeSkuCode(input: string) {
  return input.trim().replace(/\s+/g, "").toUpperCase();
}

export function assertStoreProductInput(context: StoreContext, input: StoreProductInput) {
  const parsed = storeProductInputSchema.parse(input);
  requirePermission(context, "MANAGE_CATALOG");
  requireStoreAccess(context, parsed.storeId);
  return parsed.sku ? { ...parsed, sku: { ...parsed.sku, code: normalizeSkuCode(parsed.sku.code) } } : parsed;
}

export function assertStoreProductOverride(context: StoreContext, storeId: string, input: StoreProductOverrideInput) {
  const parsed = storeProductOverrideSchema.parse(input);
  requirePermission(context, "MANAGE_CATALOG");
  requireStoreAccess(context, storeId);
  return parsed;
}

export function assertAddStoreSku(context: StoreContext, storeId: string, input: AddStoreSkuInput) {
  const parsed = addStoreSkuSchema.parse(input);
  requirePermission(context, "MANAGE_CATALOG");
  requireStoreAccess(context, storeId);
  return { ...parsed, code: normalizeSkuCode(parsed.code) };
}

export function assertArchiveStoreSku(context: StoreContext, storeId: string, input: ArchiveStoreSkuInput) {
  const parsed = archiveStoreSkuSchema.parse(input);
  requirePermission(context, "MANAGE_CATALOG");
  requireStoreAccess(context, storeId);
  return parsed;
}
