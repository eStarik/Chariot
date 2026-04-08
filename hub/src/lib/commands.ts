/**
 * Stateless Command Queue for Agents.
 * Facilitates asynchronous instruction delivery to Legions (Clusters).
 */

export interface AgentCommand {
  id: string;
  type: 'DEPLOY_FORMATION' | 'DELETE_RESOURCE';
  payload: any;
  timestamp: number;
}

// In-memory registry of pending commands per Agent ID
const commandStore: Record<string, AgentCommand[]> = {};

/**
 * Enqueues a command for a specific Agent.
 */
export function enqueueCommand(agentId: string, type: AgentCommand['type'], payload: any): string {
  if (!commandStore[agentId]) {
    commandStore[agentId] = [];
  }

  const id = Math.random().toString(36).substring(7);
  const command: AgentCommand = {
    id,
    type,
    payload,
    timestamp: Date.now(),
  };

  commandStore[agentId].push(command);
  console.info(`[Commands] Enqueued ${type} for Agent ${agentId} (ID: ${id})`);
  
  return id;
}

/**
 * Retrieves and clears all pending commands for a specific Agent.
 * This should be called during the telemetry report ingestion.
 */
export function flushCommands(agentId: string): AgentCommand[] {
  const pending = commandStore[agentId] || [];
  delete commandStore[agentId];
  
  if (pending.length > 0) {
    console.debug(`[Commands] Flushed ${pending.length} commands for Agent ${agentId}`);
  }
  
  return pending;
}
