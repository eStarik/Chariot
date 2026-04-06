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
  metadata: text('metadata').notNull(), // stringified JSON
  resources: text('resources'), // stringified JSON
  fleets: text('fleets'), // stringified JSON
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
