/**
 * Stateless Agent Registry management using PostgreSQL via Drizzle ORM.
 * Facilitates persistence of Legion discovery and telemetry reports.
 */

import { db } from './db';
import { agents } from './db/schema';
import { eq } from 'drizzle-orm';

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

export interface ClusterReport {
  resources: ClusterResources;
  fleets: FleetStatus[];
}

export interface AgentMetadata {
  clusterName?: string;
  region?: string;
  [key: string]: any;
}

export interface AgentRecord {
  agent_id: string;
  agent_token: string;
  metadata: AgentMetadata;
  lastReportTimestamp?: number;
  resources?: ClusterResources;
  fleets?: FleetStatus[];
}

/**
 * Provisions a new agent in the database or updates identity metadata.
 */
export async function registerAgent(
  agentId: string, 
  metadata: AgentMetadata, 
  agentToken: string
): Promise<AgentRecord> {
  const result = await db.insert(agents).values({
    id: agentId,
    token: agentToken,
    metadata: JSON.stringify(metadata),
  }).onConflictDoUpdate({
    target: agents.id,
    set: { 
      metadata: JSON.stringify(metadata),
      token: agentToken
    }
  }).returning();

  const record = result[0];
  return {
    agent_id: record.id,
    agent_token: record.token,
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
    metadata: JSON.parse(record.metadata),
    lastReportTimestamp: record.last_report_at ? record.last_report_at.getTime() : undefined,
    resources: record.resources ? JSON.parse(record.resources) : undefined,
    fleets: record.fleets ? JSON.parse(record.fleets) : undefined,
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
    resources: JSON.stringify(report.resources),
    fleets: JSON.stringify(report.fleets),
  }).where(eq(agents.id, agentId));

  return { success: true };
}

/**
 * Returns a read-only snapshot of all currently registered agents from the database.
 */
export async function getRegistrySnapshot(): Promise<Record<string, AgentRecord>> {
  const allAgents = await db.select().from(agents);
  const snapshot: Record<string, AgentRecord> = {};

  for (const agent of allAgents) {
    snapshot[agent.id] = {
      agent_id: agent.id,
      agent_token: agent.token,
      metadata: JSON.parse(agent.metadata),
      lastReportTimestamp: agent.last_report_at ? agent.last_report_at.getTime() : undefined,
      resources: agent.resources ? JSON.parse(agent.resources) : undefined,
      fleets: agent.fleets ? JSON.parse(agent.fleets) : undefined,
    };
  }

  return snapshot;
}
