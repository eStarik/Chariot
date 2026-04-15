import { pgTable, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

// --- Tactical Formations Table ---
// Persists the deployable fleet variants (Phalanx, Peltasts, Wedge, etc.)
export const formations = pgTable('formations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  description: text('description').notNull(),
  cpu: text('cpu').notNull(), // e.g., "2 Cores"
  memory: text('memory').notNull(), // e.g., "4 GiB"
  tickrate: text('tickrate').notNull(), // e.g., "30Hz"
  yaml_config: text('yaml_config').notNull(),
  is_restricted: boolean('is_restricted').default(false),
  created_at: timestamp('created_at').defaultNow(),
});

// --- Agent Registry & Telemetry Table ---
// Persists discovered Agones Legions and their latest resource reports
export const agents = pgTable('agents', {
  id: text('id').primaryKey(), // matches agent_id
  token: text('token').notNull(), // matches agent_token
  fingerprint: text('fingerprint').unique(), // immutable cluster signature
  status: text('status').default('connected'), // 'connected' | 'disconnected'
  metadata: text('metadata').notNull(), // stringified JSON
  resources: text('resources'), // stringified JSON
  fleets: text('fleets'), // stringified JSON
  servers: text('servers'), // stringified JSON (lists individual GameServers)
  last_report_at: timestamp('last_report_at'),
  created_at: timestamp('created_at').defaultNow(),
});

// --- SuperAdmin Settings Table ---
// Persists global system parameters (Language, Update Mgmt, etc.)
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updated_at: timestamp('updated_at'),
});

// --- Auth.js (NextAuth) Tables ---

export const users = pgTable('chariots_users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  password: text('password'), // For Native Auth
  role: text('role').default('commander'), // 'commander' (admin), 'peltast' (viewer)
});

export const accounts = pgTable('account', {
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
});

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable('verificationToken', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});
