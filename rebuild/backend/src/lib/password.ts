import { hash, verify } from '@node-rs/argon2';

const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (plain: string) => hash(plain, OPTIONS);

export async function verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plain);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/** Spends the same time as a real check so unknown logins can't be told apart by timing. */
export async function burnPasswordCheck(plain: string): Promise<void> {
  dummyHash ??= hashPassword('mk-dummy-password-for-timing');
  await verifyPassword(await dummyHash, plain);
}
