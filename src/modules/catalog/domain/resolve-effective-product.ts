export type SharedProductValues = {
  displayName: string;
  manufacturerName: string;
  packageDescription?: string;
};

export type StoreProductOverrides = Partial<SharedProductValues>;

export function resolveEffectiveProduct(
  shared: SharedProductValues,
  overrides: StoreProductOverrides,
): SharedProductValues {
  return {
    displayName: overrides.displayName ?? shared.displayName,
    manufacturerName: overrides.manufacturerName ?? shared.manufacturerName,
    packageDescription: overrides.packageDescription ?? shared.packageDescription,
  };
}
