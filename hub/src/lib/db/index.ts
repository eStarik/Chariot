import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/chariot';
const sql = postgres(connectionString);
export const db = drizzle(sql, { schema });

// Re-export the canonical seed routine from seed.ts
export { seedDatabase } from './seed';
