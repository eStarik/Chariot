/**
 * Stateless Agent Registry management using PostgreSQL via Drizzle ORM.
 * Facilitates persistence of Legion discovery and telemetry reports.
 */

import { db } from './db';
import { agents } from './db/schema';
import { eq, lte, and, isNull, not } from 'drizzle-orm';

export interface FleetStatus {
  name: string;
  replicas: number;
  readyReplicas: number;
  allocatedReplicas: number;
}

export interface ClusterResources {
  cpu: { capacity: string; usage: string };
  memory: { capacity: string; usage: string };
}

export interface ServerStatus {
  name: string;
  state: string;
  address: string;
  port: number;
}

export interface ClusterReport {
  resources: ClusterResources;
  fleets: FleetStatus[];
  servers?: ServerStatus[];
}

export interface AgentMetadata {
  clusterName?: string;
  region?: string;
  [key: string]: any;
}

export interface AgentRecord {
  agent_id: string;
  agent_token: string;
  status: string;
  metadata: AgentMetadata;
  lastReportTimestamp?: number;
  resources?: ClusterResources;
  fleets?: FleetStatus[];
  servers?: ServerStatus[];
}

/**
 * Provisions a new agent in the database or updates identity metadata.
 */
export async function registerAgent(
  agentId: string, 
  metadata: AgentMetadata, 
  agentToken: string,
  fingerprint?: string
): Promise<AgentRecord> {
  const result = await db.insert(agents).values({
    id: agentId,
    token: agentToken,
    fingerprint: fingerprint || null,
    status: 'connected',
    metadata: JSON.stringify(metadata),
  }).onConflictDoUpdate({
    target: agents.id,
    set: { 
      metadata: JSON.stringify(metadata),
      token: agentToken,
      fingerprint: fingerprint || null,
      status: 'connected'
    }
  }).returning();

  const record = result[0];
  return {
    agent_id: record.id,
    agent_token: record.token,
    status: record.status || 'connected',
    metadata: JSON.parse(record.metadata)
  };
}

/**
 * Retrieves a persistent agent record by ID.
 */
export async function getAgent(agentId: string): Promise<AgentRecord | undefined> {
  const result = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  if (result.length === 0) return undefined;

  const record = result[0];
  return {
    agent_id: record.id,
    agent_token: record.token,
    status: record.status || 'connected',
    metadata: JSON.parse(record.metadata),
    lastReportTimestamp: record.last_report_at ? record.last_report_at.getTime() : undefined,
    resources: record.resources ? JSON.parse(record.resources) : undefined,
    fleets: record.fleets ? JSON.parse(record.fleets) : undefined,
    servers: record.servers ? JSON.parse(record.servers) : undefined,
  };
}

/**
 * Retrieves an agent record by its unique fingerprint.
 */
export async function getAgentByFingerprint(fingerprint: string): Promise<AgentRecord | undefined> {
  const result = await db.select().from(agents).where(eq(agents.fingerprint, fingerprint)).limit(1);
  if (result.length === 0) return undefined;

  const record = result[0];
  return {
    agent_id: record.id,
    agent_token: record.token,
    status: record.status || 'connected',
    metadata: JSON.parse(record.metadata),
    lastReportTimestamp: record.last_report_at ? record.last_report_at.getTime() : undefined,
    resources: record.resources ? JSON.parse(record.resources) : undefined,
    fleets: record.fleets ? JSON.parse(record.fleets) : undefined,
    servers: record.servers ? JSON.parse(record.servers) : undefined,
  };
}

/**
 * Persists a resource report for a specific agent in PostgreSQL.
 * Validates identity via agentToken prior to database update.
 */
export async function saveClusterReport(
  agentId: string, 
  report: ClusterReport, 
  agentToken: string
): Promise<{ success: boolean; error?: string }> {
  const agent = await getAgent(agentId);
  
  if (!agent) {
    return { success: false, error: 'Agent record not found' };
  }

  // Security check: Verify the reporter is indeed the registered owner of this ID
  if (agent.agent_token !== agentToken) {
    return { success: false, error: 'Security violation: Unauthorized agent token' };
  }

  await db.update(agents).set({
    last_report_at: new Date(),
    status: 'connected',
    resources: JSON.stringify(report.resources),
    fleets: JSON.stringify(report.fleets),
    servers: JSON.stringify(report.servers || []),
  }).where(eq(agents.id, agentId));

  return { success: true };
}

/**
 * Automatically transitions agents to 'disconnected' status if stale.
 * Ensures ghost records are visually marked rather than categorically deleted.
 */
export async function purgeStaleAgents(thresholdMinutes: number = 5): Promise<void> {
  const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);
  
  // Transition active but stale records to disconnected
  await db.update(agents).set({ status: 'disconnected' })
    .where(and(eq(agents.status, 'connected'), lte(agents.last_report_at, cutoff)));
    
  // Cleanup agents that were created but never reported
  await db.delete(agents).where(and(isNull(agents.last_report_at), lte(agents.created_at, cutoff)));
}

/**
 * Transition an agent to 'deleted' status rather than categorical removal.
 * Fulfillment the "marked as Deleted in the DB" architectural requirement.
 */
export async function unregisterAgent(agentId: string): Promise<void> {
  await db.update(agents).set({ status: 'deleted' }).where(eq(agents.id, agentId));
}

/**
 * Manually restores a soft-deleted agent to 'connected' status.
 * Fulfillment the "entry can be manually restored by the user" requirement.
 */
export async function restoreAgent(agentId: string): Promise<void> {
  await db.update(agents).set({ status: 'connected' }).where(eq(agents.id, agentId));
}

/**
 * Returns a read-only snapshot of all currently registered agents from the database.
 * Executes a stale record purge prior to retrieval to ensure a clean dashboard view.
 */
export async function getRegistrySnapshot(): Promise<Record<string, AgentRecord>> {
  await purgeStaleAgents(); 
  
  // Exclude agents that have been explicitly soft-deleted by the user
  const allAgents = await db.select().from(agents).where(not(eq(agents.status, 'deleted')));
  const snapshot: Record<string, AgentRecord> = {};

  for (const agent of allAgents) {
    snapshot[agent.id] = {
      agent_id: agent.id,
      agent_token: agent.token,
      status: agent.status || 'connected',
      metadata: JSON.parse(agent.metadata),
      lastReportTimestamp: agent.last_report_at ? agent.last_report_at.getTime() : undefined,
      resources: agent.resources ? JSON.parse(agent.resources) : undefined,
      fleets: agent.fleets ? JSON.parse(agent.fleets) : undefined,
      servers: agent.servers ? JSON.parse(agent.servers) : undefined,
    };
  }

  return snapshot;
}
