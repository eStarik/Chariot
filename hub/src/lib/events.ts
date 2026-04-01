/**
 * Central event bus for real-time Server-Sent Events (SSE) broadcasting.
 */

export interface AgentUpdateEvent {
  type: 'CLUSTER_UPDATE';
  agentId: string;
  timestamp: number;
  payload: any;
}

export type EventCallback = (event: AgentUpdateEvent) => void;

let activeListeners: EventCallback[] = [];

/**
 * Subscribes a consumer (e.g., SSE route) to the global update stream.
 * @param callback The function to invoke upon broadcast.
 * @returns An unsubscribe function to clean up the listener.
 */
export function subscribeToEvents(callback: EventCallback): () => void {
  activeListeners.push(callback);
  return () => {
    activeListeners = activeListeners.filter(l => l !== callback);
  };
}

/**
 * Broadcasts an agent update to all connected dashboard consumers.
 * @param agentId Unique identifier of the reporting agent.
 * @param payload The structured report data.
 */
export function broadcastAgentUpdate(agentId: string, payload: any): void {
  const updateEvent: AgentUpdateEvent = {
    type: 'CLUSTER_UPDATE',
    agentId,
    timestamp: Date.now(),
    payload
  };
  
  // Dispatch to all subscribers
  activeListeners.forEach(listener => {
    try {
      listener(updateEvent);
    } catch (error) {
      console.error(`Error dispatching agent update event for ${agentId}:`, error);
    }
  });
}
