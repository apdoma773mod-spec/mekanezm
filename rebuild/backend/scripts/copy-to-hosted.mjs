// One-off: copies every table from the dev/shop DB (SRC_URL, read only) into the hosted schema (DATABASE_URL, e.g. ...?schema=mk_new).
// Usage: SRC_URL=... DATABASE_URL=... node scripts/copy-to-hosted.mjs
import { PrismaClient } from '@prisma/client';

const src = new PrismaClient({ datasourceUrl: process.env.SRC_URL });
const dst = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
const dstSchema = new URL(process.env.DATABASE_URL).searchParams.get('schema') ?? 'public';
const srcSchema = new URL(process.env.SRC_URL).searchParams.get('schema') ?? 'public';
if (dstSchema === 'public') throw new Error('refusing to write into public');

const tables = (await src.$queryRawUnsafe(`select table_name t from information_schema.tables where table_schema='${srcSchema}' and table_type='BASE TABLE' and table_name <> '_prisma_migrations' and table_name <> all(string_to_array('${process.env.SKIP_TABLES ?? ''}', ',')) order by 1`)).map((r) => r.t);
const fks = await src.$queryRawUnsafe(`select c.conrelid::regclass::text a, c.confrelid::regclass::text b from pg_constraint c where c.contype='f' and c.connamespace='${srcSchema}'::regnamespace`);
const dep = new Map(tables.map((t) => [t, new Set()]));
for (const f of fks) {
  const a = f.a.replace(/"/g, '').split('.').pop();
  const b = f.b.replace(/"/g, '').split('.').pop();
  if (a !== b && dep.has(a)) dep.get(a).add(b);
}
const order = [];
const done = new Set();
while (order.length < tables.length) {
  const next = tables.filter((t) => !done.has(t) && [...dep.get(t)].every((d) => done.has(d)));
  const pick = next.length ? next : tables.filter((t) => !done.has(t)).slice(0, 1); // cycle: just go on
  for (const t of pick) {
    order.push(t);
    done.add(t);
  }
}

let total = 0;
for (const t of order) {
  const n = Number((await src.$queryRawUnsafe(`select count(*)::int n from "${srcSchema}"."${t}"`))[0].n);
  if (!n) continue;
  await dst.$executeRawUnsafe(`truncate "${dstSchema}"."${t}" cascade`);
  const size = 300;
  for (let off = 0; off < n; off += size) {
    const rows = (await src.$queryRawUnsafe(`select coalesce(json_agg(x),'[]'::json) j from (select * from "${srcSchema}"."${t}" order by 1 offset ${off} limit ${size}) x`))[0].j;
    await dst.$executeRawUnsafe(`insert into "${dstSchema}"."${t}" select * from json_populate_recordset(null::"${dstSchema}"."${t}", $1::json)`, JSON.stringify(rows));
  }
  total += n;
  console.log(t, n);
}
// keep autoincrement sequences ahead of the copied ids
const seqs = await dst.$queryRawUnsafe(`select c.table_name t, c.column_name col, pg_get_serial_sequence('"${dstSchema}"."' || c.table_name || '"', c.column_name) s from information_schema.columns c where c.table_schema='${dstSchema}' and c.column_default like 'nextval%'`);
for (const s of seqs) if (s.s) await dst.$executeRawUnsafe(`select setval('${s.s}', greatest((select coalesce(max("${s.col}"),0) from "${dstSchema}"."${s.t}"),1))`);
console.log('TOTAL rows', total);
await src.$disconnect();
await dst.$disconnect();
