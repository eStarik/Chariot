import { describe, it, expect, vi, beforeEach } from 'vitest';
// We expect to implement these in agent/monitor.ts
// @ts-ignore
import { getClusterCapacity, getAgonesFleetSummary } from '../monitor';

// Mocking the Kubernetes client
vi.mock('@kubernetes/client-node', () => {
  return {
    KubeConfig: vi.fn().mockImplementation(() => ({
      loadFromDefault: vi.fn(),
      makeApiClient: vi.fn().mockImplementation((apiClass) => {
        if (apiClass.name === 'CoreV1Api') {
          return {
            listNode: vi.fn().mockResolvedValue({
              body: {
                items: [
                  { status: { capacity: { cpu: '4', memory: '16Gi' } } }
                ]
              }
            }),
            listPodForAllNamespaces: vi.fn().mockResolvedValue({
              body: {
                items: [
                  { 
                    status: { phase: 'Running' },
                    spec: { containers: [{ resources: { requests: { cpu: '100m', memory: '256Mi' } } }] } 
                  }
                ]
              }
            })
          };
        }
        if (apiClass.name === 'CustomObjectsApi') {
          return {
            listClusterCustomObject: vi.fn().mockResolvedValue({
              body: {
                items: [
                  {
                    metadata: { name: 'fleet-1', namespace: 'default' },
                    status: { readyReplicas: 5, allocatedReplicas: 2 }
                  }
                ]
              }
            })
          };
        }
      })
    })),
    CoreV1Api: class {},
    CustomObjectsApi: class {}
  };
});

describe('Agent Monitoring Logic', () => {
  it('should correctly calculate cluster CPU and RAM capacity', async () => {
    const metrics = await getClusterCapacity();
    
    expect(metrics.cpuTotal).toBe(4);
    expect(metrics.ramTotal).toBe(16); // GiB
    expect(metrics.cpuUsed).toBeGreaterThan(0);
    expect(metrics.ramUsed).toBeGreaterThan(0);
  });

  it('should correctly aggregate Agones fleet summaries', async () => {
    const fleets = await getAgonesFleetSummary(['default']);
    
    expect(fleets).toHaveLength(1);
    expect(fleets[0].fleetName).toBe('fleet-1');
    expect(fleets[0].ready).toBe(5);
    expect(fleets[0].allocated).toBe(2);
  });
});
