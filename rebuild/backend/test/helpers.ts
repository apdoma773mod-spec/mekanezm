import { PrismaClient, type Role } from '@prisma/client';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { hashPassword } from '../src/lib/password.js';

export const PASSWORD = 'test-password-123';
export const SMS_TOKEN = 'sms-test-token';
export const BRIDGE_SECRET = 'bridge-test-secret';

export async function createTestApp(): Promise<{ app: FastifyInstance; prisma: PrismaClient }> {
  const url = process.env.TEST_DATABASE_URL!;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const config = loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: url,
    JWT_SECRET: 'test-secret-that-is-long-enough-0123456789',
    LOGIN_RATE_LIMIT_MAX: '1000',
    SMS_TOKEN: SMS_TOKEN,
    BRIDGE_SECRET: BRIDGE_SECRET,
  });
  const app = await buildApp({ config, prisma });
  await app.ready();
  return { app, prisma };
}

export async function resetDb(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "AuditLog", "RefreshToken", "Setting", "User", "Counter", "Product", "StockMove", "Contact",
      "Invoice", "InvoiceItem", "Payment", "Return", "Expense", "DaybookEntry", "DayClosing", "StockCount",
      "Quote", "Shipment", "Gift", "Staff", "Attendance", "StaffMove", "StaffPoint", "PunchCode", "Kit", "Sample", "WantedItem",
      "Partner", "PartnerMove", "Vehicle", "VehicleLog", "FieldOrder", "VanStock", "VanMove", "VanClose", "Contract", "OutboundMessage",
      "SmsIn", "WaOrder", "WaPhoto", "Backup", "WebOrder", "Portal", "PortalMsg"
      RESTART IDENTITY CASCADE`,
  );
}

export async function createUser(prisma: PrismaClient, phone: string, role: Role, name = 'مستخدم') {
  return prisma.user.create({ data: { name, phone, role, passwordHash: await hashPassword(PASSWORD) } });
}

/** Turns Set-Cookie headers into a Cookie header for the next request. */
export function cookiesOf(res: LightMyRequestResponse): string {
  return res.cookies
    .filter((c) => c.value !== '')
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

export async function login(app: FastifyInstance, loginId: string, password = PASSWORD): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { login: loginId, password } });
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.statusCode} ${res.body}`);
  return cookiesOf(res);
}
