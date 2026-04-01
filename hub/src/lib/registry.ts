export interface AgentRecord {
  agent_id: string;
  agent_token: string;
  metadata: any;
  lastReportTimestamp?: number;
  resources?: any;
  fleets?: any[];
}

let registry: Record<string, AgentRecord> = {};

/**
 * Registers an agent in the local registry.
 */
export function registerAgent(agent_id: string, metadata: any, agent_token: string): AgentRecord {
  const record: AgentRecord = {
    agent_id,
    agent_token,
    metadata
  };
  
  registry[agent_id] = record;
  return record;
}

/**
 * Retrieves an agent record by ID.
 */
export function getAgent(agent_id: string): AgentRecord | undefined {
  return registry[agent_id];
}

/**
 * Clears the registry (mainly for testing).
 */
export function clearRegistry(): void {
  registry = {};
}

/**
 * Persists a resource report for a specific agent.
 * Requires validation of the agentToken.
 */
export async function saveClusterReport(
  agentId: string, 
  report: any, 
  agentToken: string
): Promise<{ success: boolean; error?: string }> {
  const agent = registry[agentId];
  
  if (!agent) {
    return { success: false, error: 'Agent not found' };
  }

  // Impersonation Protection
  if (agent.agent_token !== agentToken) {
    return { success: false, error: 'Invalid agent token' };
  }

  agent.lastReportTimestamp = Date.now();
  agent.resources = report.resources;
  agent.fleets = report.fleets;

  return { success: true };
}

export function getRegistry() {
  return registry;
}
