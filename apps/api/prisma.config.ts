import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 reads the connection string from here, not from schema.prisma.
// `prisma generate` doesn't need a database, so a missing DATABASE_URL only matters for
// commands that connect (migrate, studio).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
