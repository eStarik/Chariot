import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getClusterCapacity, getAgonesFleetSummary, getAgonesGameServerSummary } from '../monitor';

const { mockCoreApi, mockCustomApi, mockListClusterCustomObject } = vi.hoisted(() => {
  const mockListCluster = vi.fn().mockResolvedValue({
    items: [
      { metadata: { namespace: 'default', name: 'fleet-1' }, status: { readyReplicas: 5, allocatedReplicas: 2 } }
    ]
  });
  const coreApi = {
    listNode: vi.fn().mockResolvedValue({ items: [{ status: { capacity: { cpu: '4', memory: '16Gi' } } }] }),
    listPodForAllNamespaces: vi.fn().mockResolvedValue({ items: [{ status: { phase: 'Running' }, spec: { containers: [{ resources: { requests: { cpu: '1', memory: '2Gi' } } }] } }] }),
    readNamespace: vi.fn().mockResolvedValue({ metadata: { uid: 'test-cluster-uid' } })
  };
  return { mockCoreApi: coreApi, mockCustomApi: { listClusterCustomObject: mockListCluster }, mockListClusterCustomObject: mockListCluster };
});

vi.mock('@kubernetes/client-node', () => {
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
