import { describe, it, expect, vi, beforeEach } from 'vitest';
// @ts-ignore
import { saveClusterReport, clearRegistry } from '../src/lib/registry';
// We'll implement this event emitter for SSE
// @ts-ignore
import { subscribeToEvents, broadcastUpdate } from '../src/lib/events';

describe('Hub Event Broadcasting (SSE)', () => {
  beforeEach(() => {
    clearRegistry();
    vi.resetAllMocks();
  });

  it('should broadcast an update when a valid report is received', async () => {
    const broadcastSpy = vi.fn();
    const unsubscribe = subscribeToEvents(broadcastSpy);

    const agentId = 'agent-123';
    const report = { resources: { cpuTotal: 4 }, fleets: [] };
    
    // Simulate the broadcast that should happen in the API route
    broadcastUpdate(agentId, report);

    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CLUSTER_UPDATE',
        agentId: 'agent-123',
        data: report
      })
    );

    unsubscribe();
  });
});
