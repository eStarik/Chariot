type Callback = (data: any) => void;
let listeners: Callback[] = [];

/**
 * Subscribes a listener to the event stream.
 * @param callback Function to call when an update occurs
 * @returns Unsubscribe function
 */
export function subscribeToEvents(callback: Callback) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
}

/**
 * Broadcasts an update to all connected listeners.
 * @param agentId The ID of the reporting agent
 * @param data The report payload
 */
export function broadcastUpdate(agentId: string, data: any) {
  const event = {
    type: 'CLUSTER_UPDATE',
    agentId,
    timestamp: Date.now(),
    data
  };
  
  listeners.forEach(l => l(event));
}
