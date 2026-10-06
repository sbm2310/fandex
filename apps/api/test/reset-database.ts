import type { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Reference data synced from the universe seed at startup. It isn't test data, so it stays;
 * link tables still empty through their catalog items.
 */
const KEPT_TABLES = ['_prisma_migrations', 'universe', 'character', 'sync_state'];

/** Empties every application table (keeps migration history and reference data) between tests. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const tables = (
    await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
  ).filter(({ tablename }) => !KEPT_TABLES.includes(tablename));
  if (tables.length === 0) return;
  const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
