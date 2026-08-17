import { describe, expect, it } from "vitest";

import { MembershipRole, SystemRole } from "@/generated/prisma/client";
import { ForbiddenError } from "@/modules/identity/application/auth-errors";
import type { StoreContext } from "@/modules/identity/application/store-context";

import {
  addStoreSkuSchema,
  assertStoreProductInput,
  assertStoreProductOverride,
  storeProductInputSchema,
} from "./store-product-service";

const context: StoreContext = {
  actor: { id: "user-1", email: "owner@example.com", displayName: null, isActive: true, emailVerifiedAt: null, systemRole: SystemRole.USER },
  store: { id: "00000000-0000-4000-8000-000000000010", code: "A", name: "A", timezone: "Asia/Bangkok", isActive: true },
  storeId: "00000000-0000-4000-8000-000000000010",
  role: MembershipRole.OWNER,
};

const validInput = {
  storeId: "00000000-0000-4000-8000-000000000010",
  displayName: "Paracetamol 500mg",
  baseUnitId: "00000000-0000-4000-8000-000000000001",
  minimumStockBase: 0,
  sku: {
    code: "PARA-500-BOX",
    unitId: "00000000-0000-4000-8000-000000000002",
    quantityInBaseUnit: 100,
    sellingPriceMinor: 25000,
  },
};

describe("store product application boundary", () => {
  it("requires tenant context and validates positive conversion/integer price", () => {
    expect(assertStoreProductInput(context, validInput)).toEqual(validInput);
    expect(() => storeProductInputSchema.parse({ ...validInput, sku: { ...validInput.sku, quantityInBaseUnit: 0 } })).toThrow();
    expect(() => storeProductInputSchema.parse({ ...validInput, sku: { ...validInput.sku, sellingPriceMinor: 1.5 } })).toThrow();
    expect(() => assertStoreProductInput(context, { ...validInput, storeId: "00000000-0000-4000-8000-000000000011" })).toThrow(ForbiddenError);
  });

  it("rejects an empty override and accepts explicit store-local changes", () => {
    expect(() => assertStoreProductOverride(context, context.storeId, {})).toThrow();
    expect(assertStoreProductOverride(context, context.storeId, { displayName: "Tên riêng" })).toEqual({ displayName: "Tên riêng" });
  });

  it("validates SKU quantity and price at the application boundary", () => {
    const sku = { code: "SKU-1", unitId: "00000000-0000-4000-8000-000000000002", quantityInBaseUnit: 1, sellingPriceMinor: 100 };
    expect(() => addStoreSkuSchema.parse({ ...sku, quantityInBaseUnit: 0 })).toThrow();
    expect(() => addStoreSkuSchema.parse({ ...sku, sellingPriceMinor: -1 })).toThrow();
    expect(() => addStoreSkuSchema.parse({ ...sku, sellingPriceMinor: 1.2 })).toThrow();
  });
});
