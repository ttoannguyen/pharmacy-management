import { cookies } from "next/headers";

const ACTIVE_STORE_COOKIE = "pharmacy_active_store";

export async function getSelectedStoreId() {
  return (await cookies()).get(ACTIVE_STORE_COOKIE)?.value ?? null;
}

export async function setSelectedStoreId(storeId: string) {
  (await cookies()).set(ACTIVE_STORE_COOKIE, storeId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function clearSelectedStoreId() {
  (await cookies()).set(ACTIVE_STORE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}
