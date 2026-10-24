import type { Prisma, PrismaClient } from '@prisma/client';
import { DEFAULT_SETTINGS, SETTING_KEYS, settingSchemas, type SettingKey, type SettingsMap } from '@mk/shared';
import { writeAudit } from '../../lib/audit.js';
import { withTx } from '../../lib/tx.js';
import type { Actor } from '../users/service.js';

/** Stored values are re-validated on read; anything stale or broken falls back to the default. */
function coerce<K extends SettingKey>(key: K, raw: unknown): SettingsMap[K] {
  const parsed = settingSchemas[key].safeParse(raw);
  return (parsed.success ? parsed.data : DEFAULT_SETTINGS[key]) as SettingsMap[K];
}

export class SettingsService {
  constructor(private readonly prisma: PrismaClient) {}

  async getAll(): Promise<SettingsMap> {
    const rows = await this.prisma.setting.findMany({ where: { key: { in: SETTING_KEYS } } });
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    return {
      store: byKey.has('store') ? coerce('store', byKey.get('store')) : DEFAULT_SETTINGS.store,
      theme: byKey.has('theme') ? coerce('theme', byKey.get('theme')) : DEFAULT_SETTINGS.theme,
    };
  }

  async set<K extends SettingKey>(key: K, raw: unknown, actor: Actor): Promise<SettingsMap[K]> {
    const value = settingSchemas[key].parse(raw) as SettingsMap[K];
    const json = value as unknown as Prisma.InputJsonValue;
    await withTx(this.prisma, async (tx) => {
      const before = await tx.setting.findUnique({ where: { key } });
      await tx.setting.upsert({
        where: { key },
        create: { key, value: json, updatedById: actor.id },
        update: { value: json, updatedById: actor.id },
      });
      await writeAudit(tx, {
        userId: actor.id,
        action: 'SETTING_UPDATE',
        entity: 'Setting',
        entityId: key,
        before: before?.value,
        after: value,
        ip: actor.ip,
      });
    });
    return value;
  }
}
