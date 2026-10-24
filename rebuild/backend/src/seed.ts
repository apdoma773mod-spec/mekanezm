import { PrismaClient, type Prisma } from '@prisma/client';
import { z } from 'zod';
import { DEFAULT_SETTINGS, EG_MOBILE_RE, SETTING_KEYS, normalizePhone } from '@mk/shared';
import { hashPassword } from './lib/password.js';

const phone = z.string().transform(normalizePhone).refine((v) => EG_MOBILE_RE.test(v), 'invalid phone');

const env = z
  .object({
    SEED_ADMIN_NAME: z.string().min(2),
    SEED_ADMIN_PHONE: phone,
    SEED_ADMIN_PASSWORD: z.string().min(8),
    SEED_STAFF_NAME: z.string().min(2).optional(),
    SEED_STAFF_PHONE: phone.optional(),
    SEED_STAFF_PASSWORD: z.string().min(8).optional(),
  })
  .parse(process.env);

const prisma = new PrismaClient();

async function ensureUser(name: string, phoneNo: string, password: string, role: 'ADMIN' | 'STAFF') {
  const existing = await prisma.user.findUnique({ where: { phone: phoneNo } });
  if (existing) {
    console.log(`= ${role} ${phoneNo} already exists, left unchanged`);
    return;
  }
  await prisma.user.create({ data: { name, phone: phoneNo, role, passwordHash: await hashPassword(password) } });
  console.log(`+ created ${role} ${phoneNo}`);
}

async function main() {
  await ensureUser(env.SEED_ADMIN_NAME, env.SEED_ADMIN_PHONE, env.SEED_ADMIN_PASSWORD, 'ADMIN');
  if (env.SEED_STAFF_NAME && env.SEED_STAFF_PHONE && env.SEED_STAFF_PASSWORD) {
    await ensureUser(env.SEED_STAFF_NAME, env.SEED_STAFF_PHONE, env.SEED_STAFF_PASSWORD, 'STAFF');
  }
  for (const key of SETTING_KEYS) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: DEFAULT_SETTINGS[key] as unknown as Prisma.InputJsonValue },
      update: {},
    });
  }
  console.log('+ default settings ensured');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
