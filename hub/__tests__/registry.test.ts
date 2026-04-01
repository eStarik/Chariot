import { describe, it, expect, beforeEach } from 'vitest';
// We expect to implement these in hub/src/lib/registry.ts
// @ts-ignore
import { saveClusterReport, getRegistry, clearRegistry, registerAgent } from '../src/lib/registry';

describe('Hub Cluster Registry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('should reject reports from unknown agents', async () => {
    const report = { resources: { cpuTotal: 4, cpuUsed: 1 }, fleets: [] };
    const result = await saveClusterReport('unknown-id', report);
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('Agent not found');
  });

  it('should successfully update an agent record with new metrics', async () => {
    const agentId = 'test-agent-001';
    // Manually register an agent for testing
    registerAgent(agentId, { cluster_name: 'test-cluster' });

    const report = { 
      resources: { cpuTotal: 8, cpuUsed: 2, ramTotal: 32, ramUsed: 4 }, 
      fleets: [{ fleetName: 'hub-fleet', ready: 10, allocated: 5 }] 
    };

    const result = await saveClusterReport(agentId, report);
    expect(result.success).toBe(true);

    const registry = getRegistry();
    expect(registry[agentId].resources.cpuTotal).toBe(8);
    expect(registry[agentId].fleets).toHaveLength(1);
    expect(registry[agentId].lastReportTimestamp).toBeDefined();
  });
});
