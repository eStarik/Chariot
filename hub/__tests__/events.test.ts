import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearRegistry } from '../src/lib/registry';
import { subscribeToEvents, broadcastAgentUpdate } from '../src/lib/events';

describe('Hub Event Broadcasting (SSE)', () => {
  beforeEach(() => {
    clearRegistry();
    vi.resetAllMocks();
  });

  it('should broadcast an update when a valid report is received', async () => {
    const broadcastSpy = vi.fn();
    const unsubscribe = subscribeToEvents(broadcastSpy);

    const agentId = 'agent-123';
    const telemetryPayload = { 
      resources: { cpu: { capacity: '4', usage: '1' }, memory: { capacity: '16', usage: '2' } }, 
      fleets: [] 
    };
    
    // Simulate the broadcast normally triggered by the Telemetry Ingestion route
    broadcastAgentUpdate(agentId, telemetryPayload);

    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CLUSTER_UPDATE',
        agentId: 'agent-123',
        payload: telemetryPayload
      })
    );

    unsubscribe();
  });
});
