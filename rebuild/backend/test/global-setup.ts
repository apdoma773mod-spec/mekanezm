import { execSync } from 'node:child_process';

/** Applies migrations to the dedicated test database before any test file runs. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('Set TEST_DATABASE_URL to an empty Postgres database used only for tests');
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
}
