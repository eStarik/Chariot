import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
  sql: postgres.Sql | undefined;
};

function getConnectionString(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  if (process.env.NODE_ENV === 'production') {
    console.warn('[DB] WARNING: DATABASE_URL is not defined in production. Using fallback.');
  }
  return 'postgres://postgres:postgres@localhost:5432/chariot';
}

const connectionString = getConnectionString();
if (process.env.DATABASE_URL) {
  console.log(`[DB] Initializing connection to: ${connectionString.split('@')[1] || 'localhost'}`);
} else {
  console.log('[DB] Warning: Using fallback connection string (Build phase?).');
}

const queryClient = globalForDb.sql ?? postgres(connectionString, {
  onnotice: (notice) => console.log('[DB Notice]', notice),
});
if (process.env.NODE_ENV !== 'production') globalForDb.sql = queryClient;

export const db = drizzle(queryClient, { schema, logger: true });

// Re-export the canonical seed routine from seed.ts
export { seedDatabase } from './seed';
