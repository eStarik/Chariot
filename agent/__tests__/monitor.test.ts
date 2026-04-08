import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getClusterCapacity, getAgonesFleetSummary, getAgonesGameServerSummary } from '../monitor';

// Mock for @kubernetes/client-node
const mockListClusterCustomObject = vi.fn();

vi.mock('@kubernetes/client-node', () => {
  };

  return {
    KubeConfig: class {
      loadFromDefault = vi.fn();
      makeApiClient = vi.fn().mockImplementation((apiClass) => {
        if (apiClass.name === 'CoreV1Api') return mockCoreApi;
        if (apiClass.name === 'CustomObjectsApi') return mockCustomApi;
        return {};
      });
    },
    CoreV1Api: class { static name = 'CoreV1Api'; },
    CustomObjectsApi: class { static name = 'CustomObjectsApi'; }
  };
});

describe('Agent Monitoring Logic', () => {
  it('should correctly calculate cluster CPU and RAM capacity', async () => {
    const metrics = await getClusterCapacity();
    
    // Validates the math against the mock data (4 cores, 16Gi RAM)
    expect(metrics.cpuTotal).toBe(4);
    expect(metrics.ramTotal).toBe(16); // GiB
    expect(metrics.cpuUsed).toBeGreaterThan(0);
    expect(metrics.ramUsed).toBeGreaterThan(0);
  });

  it('should correctly aggregate Agones fleet summaries', async () => {
    const namespaces = ['default'];
    const fleets = await getAgonesFleetSummary(namespaces);
    
    expect(fleets).toHaveLength(1);
    expect(fleets[0].fleetName).toBe('fleet-1');
    expect(fleets[0].ready).toBe(5);
    expect(fleets[0].allocated).toBe(2);
  });
});
