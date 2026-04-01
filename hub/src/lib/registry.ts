/**
 * In-memory state management for registered Agones Agents.
 */

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

let agentRegistry: Record<string, AgentRecord> = {};

/**
 * Registers an agent in the local store.
 */
export function registerAgent(
  agentId: string, 
  metadata: AgentMetadata, 
  agentToken: string
): AgentRecord {
  const record: AgentRecord = {
    agent_id: agentId,
    agent_token: agentToken,
    metadata
  };
  
  agentRegistry[agentId] = record;
  return record;
}

/**
 * Retrieves an agent record by ID.
 */
export function getAgent(agentId: string): AgentRecord | undefined {
  return agentRegistry[agentId];
}

/**
 * Clears all registered agents (primarily for testing).
 */
export function clearRegistry(): void {
  agentRegistry = {};
}

/**
 * Persists a resource report for a specific agent.
 * Validates identity via agentToken prior to update.
 */
export async function saveClusterReport(
  agentId: string, 
  report: ClusterReport, 
  agentToken: string
): Promise<{ success: boolean; error?: string }> {
  const agent = agentRegistry[agentId];
  
  if (!agent) {
    return { success: false, error: 'Agent record not found' };
  }

  // Security check: Verify the reporter is indeed the registered owner of this ID
  if (agent.agent_token !== agentToken) {
    return { success: false, error: 'Security violation: Unauthorized agent token' };
  }

  agent.lastReportTimestamp = Date.now();
  agent.resources = report.resources;
  agent.fleets = report.fleets;

  return { success: true };
}

/**
 * Returns a read-only snapshot of the current registry state.
 */
export function getRegistrySnapshot(): Record<string, AgentRecord> {
  return { ...agentRegistry };
}
