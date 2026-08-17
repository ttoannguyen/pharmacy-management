import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  CatalogSource,
  MembershipRole,
  PrismaClient,
  VerificationStatus,
} from "../src/generated/prisma/client";
import { hashPassword } from "../src/modules/identity/application/password";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const ids = {
  user: "10000000-0000-4000-8000-000000000001",
  store: "20000000-0000-4000-8000-000000000001",
  ingredient: "30000000-0000-4000-8000-000000000001",
  concept: "40000000-0000-4000-8000-000000000001",
  manufacturer: "50000000-0000-4000-8000-000000000001",
  registeredProduct: "60000000-0000-4000-8000-000000000001",
  registeredProductVersion: "61000000-0000-4000-8000-000000000001",
  productPackage: "70000000-0000-4000-8000-000000000001",
  globalBarcode: "71000000-0000-4000-8000-000000000001",
  storeProduct: "80000000-0000-4000-8000-000000000001",
  storeSku: "90000000-0000-4000-8000-000000000001",
  storeBarcode: "91000000-0000-4000-8000-000000000001",
} as const;

async function seedUnits() {
  const units = [
    { code: "TABLET", name: "Viên" },
    { code: "BLISTER", name: "Vỉ" },
    { code: "BOX", name: "Hộp" },
    { code: "BOTTLE", name: "Chai" },
    { code: "VIAL", name: "Lọ" },
    { code: "AMPOULE", name: "Ống" },
    { code: "TUBE", name: "Tuýp" },
    { code: "SACHET", name: "Gói" },
  ];

  await Promise.all(
    units.map((unit) =>
      prisma.unit.upsert({
        where: { code: unit.code },
        update: { name: unit.name },
        create: unit,
      }),
    ),
  );
}

async function seedDemoCatalog() {
  const tabletUnit = await prisma.unit.findUniqueOrThrow({ where: { code: "TABLET" } });
  const boxUnit = await prisma.unit.findUniqueOrThrow({ where: { code: "BOX" } });
  const demoPasswordHash = await hashPassword("DemoPassword123!");

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { id: ids.user },
      update: { passwordHash: demoPasswordHash },
      create: {
        id: ids.user,
        externalAuthId: "synthetic-demo-owner",
        email: "owner@demo.invalid",
        displayName: "Chủ nhà thuốc Demo",
        passwordHash: demoPasswordHash,
      },
    });

    const store = await tx.store.upsert({
      where: { id: ids.store },
      update: {},
      create: {
        id: ids.store,
        code: "DEMO-PHARMACY",
        name: "Nhà thuốc Demo",
      },
    });

    await tx.membership.upsert({
      where: { userId_storeId: { userId: user.id, storeId: store.id } },
      update: { role: MembershipRole.OWNER, isActive: true },
      create: {
        userId: user.id,
        storeId: store.id,
        role: MembershipRole.OWNER,
      },
    });

    await tx.ingredient.upsert({
      where: { id: ids.ingredient },
      update: {},
      create: {
        id: ids.ingredient,
        normalizedName: "paracetamol",
        displayName: "Paracetamol",
      },
    });

    await tx.drugConcept.upsert({
      where: { id: ids.concept },
      update: {},
      create: {
        id: ids.concept,
        normalizedName: "paracetamol 500 mg vien nen duong uong",
        dosageForm: "Viên nén",
        route: "Đường uống",
      },
    });

    await tx.drugConceptIngredient.upsert({
      where: {
        conceptId_ingredientId: {
          conceptId: ids.concept,
          ingredientId: ids.ingredient,
        },
      },
      update: { strengthValue: "500", strengthUnit: "mg" },
      create: {
        conceptId: ids.concept,
        ingredientId: ids.ingredient,
        strengthValue: "500",
        strengthUnit: "mg",
      },
    });

    await tx.manufacturer.upsert({
      where: { id: ids.manufacturer },
      update: {},
      create: {
        id: ids.manufacturer,
        normalizedName: "demo pharma",
        displayName: "Demo Pharma",
        countryCode: "VN",
      },
    });

    await tx.registeredProduct.upsert({
      where: { id: ids.registeredProduct },
      update: {},
      create: {
        id: ids.registeredProduct,
        conceptId: ids.concept,
        manufacturerId: ids.manufacturer,
        officialId: "DEMO-OFFICIAL-001",
        registrationNumber: "DEMO-REG-001",
        brandName: "Paracetamol Demo 500",
        status: "DEMO_ONLY",
        source: CatalogSource.SYNTHETIC_DEMO,
        verificationStatus: VerificationStatus.UNVERIFIED,
      },
    });

    await tx.registeredProductVersion.upsert({
      where: {
        registeredProductId_version: {
          registeredProductId: ids.registeredProduct,
          version: 1,
        },
      },
      update: {},
      create: {
        id: ids.registeredProductVersion,
        registeredProductId: ids.registeredProduct,
        version: 1,
        data: { demo: true, warning: "Synthetic portfolio data; not for medical use." },
        source: CatalogSource.SYNTHETIC_DEMO,
        validFrom: new Date("2026-08-17T00:00:00.000Z"),
      },
    });

    await tx.productPackage.upsert({
      where: { id: ids.productPackage },
      update: {},
      create: {
        id: ids.productPackage,
        registeredProductId: ids.registeredProduct,
        description: "Hộp 10 vỉ x 10 viên (dữ liệu demo)",
        packageQuantity: "100",
        packageUnit: "viên",
        verificationStatus: VerificationStatus.UNVERIFIED,
      },
    });

    await tx.globalBarcode.upsert({
      where: { id: ids.globalBarcode },
      update: {},
      create: {
        id: ids.globalBarcode,
        productPackageId: ids.productPackage,
        barcode: "DEMO000001",
        verificationStatus: VerificationStatus.UNVERIFIED,
        source: CatalogSource.SYNTHETIC_DEMO,
      },
    });

    await tx.storeProduct.upsert({
      where: { id: ids.storeProduct },
      update: {},
      create: {
        id: ids.storeProduct,
        storeId: ids.store,
        registeredProductId: ids.registeredProduct,
        baseUnitId: tabletUnit.id,
        displayName: "Para Demo 500",
        basedOnGlobalVersion: 1,
        overrides: { displayName: "Para Demo 500" },
      },
    });

    await tx.storeSku.upsert({
      where: { id: ids.storeSku },
      update: {},
      create: {
        id: ids.storeSku,
        storeId: ids.store,
        storeProductId: ids.storeProduct,
        productPackageId: ids.productPackage,
        unitId: boxUnit.id,
        code: "DEMO-PARA-500-BOX",
        quantityInBaseUnit: "100",
        sellingPriceMinor: 50_000n,
      },
    });

    await tx.storeBarcode.upsert({
      where: { id: ids.storeBarcode },
      update: {},
      create: {
        id: ids.storeBarcode,
        storeId: ids.store,
        storeSkuId: ids.storeSku,
        barcode: "DEMO000001",
        isInternal: true,
      },
    });
  }, {
    maxWait: 10_000,
    timeout: 30_000,
  });
}

async function main() {
  await seedUnits();
  await seedDemoCatalog();

  const [unitCount, storeCount, storeProductCount] = await Promise.all([
    prisma.unit.count(),
    prisma.store.count({ where: { id: ids.store } }),
    prisma.storeProduct.count({ where: { storeId: ids.store } }),
  ]);

  console.info({ unitCount, demoStoreCount: storeCount, demoStoreProductCount: storeProductCount });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
