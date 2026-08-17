import { describe, expect, it } from "vitest";

import { resolveEffectiveProduct } from "./resolve-effective-product";

describe("resolveEffectiveProduct", () => {
  const shared = {
    displayName: "Paracetamol 500 mg",
    manufacturerName: "DHG Pharma",
    packageDescription: "Hộp 10 vỉ x 10 viên",
  };

  it("uses shared values when the store has no override", () => {
    expect(resolveEffectiveProduct(shared, {})).toEqual(shared);
  });

  it("overrides only fields customized by the store", () => {
    expect(resolveEffectiveProduct(shared, { displayName: "Para DHG 500" })).toEqual({
      ...shared,
      displayName: "Para DHG 500",
    });
  });
});
