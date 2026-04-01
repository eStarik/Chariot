import { describe, it, expect, beforeEach } from 'vitest';
import { saveClusterReport, getRegistrySnapshot, clearRegistry, registerAgent, ClusterReport } from '../src/lib/registry';

describe('Hub Cluster Registry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  const validToken = 'secure-test-token-123';

  it('should reject reports from unknown agents', async () => {
    const telemetryPayload: ClusterReport = { 
      resources: { cpu: { capacity: '4', usage: '1' }, memory: { capacity: '16', usage: '2' } }, 
      fleets: [] 
    };
    const ingestionResult = await saveClusterReport('unknown-id', telemetryPayload, validToken);
    
    expect(ingestionResult.success).toBe(false);
    expect(ingestionResult.error).toBe('Agent record not found');
  });

  it('should successfully update an agent record with new metrics', async () => {
    const agentId = 'test-agent-001';
    // Registry now requires an identity token and metadata on registration
    registerAgent(agentId, { clusterName: 'test-cluster' }, validToken);

    const telemetryPayload: ClusterReport = { 
      resources: { 
        cpu: { capacity: '8', usage: '2' }, 
        memory: { capacity: '32', usage: '4' } 
      }, 
      fleets: [{ name: 'hub-fleet', replicas: 15, readyReplicas: 10, allocatedReplicas: 5 }] 
    };

    const ingestionResult = await saveClusterReport(agentId, telemetryPayload, validToken);
    expect(ingestionResult.success).toBe(true);

    const snapshot = getRegistrySnapshot();
    expect(snapshot[agentId].resources?.cpu.capacity).toBe('8');
    expect(snapshot[agentId].fleets).toHaveLength(1);
    expect(snapshot[agentId].lastReportTimestamp).toBeDefined();
  });
});
