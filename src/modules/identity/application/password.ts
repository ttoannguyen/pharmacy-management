import argon2 from "argon2";

const ARGON2_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { ...ARGON2_OPTIONS, raw: false });
}

export function verifyPassword(passwordHash: string, password: string) {
  return argon2.verify(passwordHash, password);
}

// Used when the email does not exist, keeping the password verification cost
// similar enough to reduce account-enumeration timing differences.
export const dummyPasswordHash = hashPassword("pharmacy-invalid-password");
