import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveClusterReport, getRegistrySnapshot, registerAgent, ClusterReport } from '../src/lib/registry';

// Global mock references
const mockLimit = vi.fn();
const mockSelectFromValues = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();

vi.mock('@/lib/db', () => {
  const selectChain = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => selectChain),
    limit: vi.fn(() => selectChain),
    not: vi.fn(() => selectChain),
    eq: vi.fn(() => selectChain),
    then: (resolve: any) => mockSelectFromValues().then(resolve),
  };

  return {
    db: {
      select: vi.fn(() => selectChain),
      insert: vi.fn((...args) => mockInsert(...args)),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockImplementation((...args) => {
            mockUpdate(...args);
            return Promise.resolve();
          })
        }))
      })),
      delete: vi.fn(() => ({
        where: vi.fn().mockImplementation(() => {
          return Promise.resolve();
        })
      })),
    }
  };
});

vi.mock('@/lib/db/schema', () => ({
  agents: { id: 'agents_table' },
  formations: { id: 'formations_table' },
  settings: { id: 'settings_table' }
}));

describe('Hub Cluster Registry', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Default implementations
    mockSelectFromValues.mockResolvedValue([]);
    mockLimit.mockResolvedValue([]);
    
    mockInsert.mockImplementation((table) => ({
      values: vi.fn().mockImplementation((v) => {
        const val = Array.isArray(v) ? v[0] : v;
        return {
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ 
              id: val.id || 'test-id', 
              token: val.token || 'test-token', 
              status: val.status || 'connected',
              metadata: val.metadata || '{}' 
            }])
          }),
          returning: vi.fn().mockResolvedValue([{ 
            id: val.id || 'test-id', 
            token: val.token || 'test-token', 
            status: val.status || 'connected',
            metadata: val.metadata || '{}' 
          }])
        };
      })
    }));
  });

  const validToken = 'secure-test-token-123';

  it('should reject reports from unknown agents', async () => {
    const telemetryPayload: ClusterReport = { 
      resources: { cpu: { capacity: '4', usage: '1' }, memory: { capacity: '16', usage: '2' } }, 
      fleets: [] 
    };
    
    mockSelectFromValues.mockResolvedValueOnce([]); // Simulate agent not found during reporting select

    const ingestionResult = await saveClusterReport('unknown-id', telemetryPayload, validToken);
    
    expect(ingestionResult.success).toBe(false);
    expect(ingestionResult.error).toBe('Agent record not found');
  });

  it('should successfully update an agent record with new metrics', async () => {
    const agentId = 'test-agent-001';
    
    // Simulate finding the agent during reporting
    mockSelectFromValues.mockResolvedValueOnce([
      { id: agentId, token: validToken, metadata: JSON.stringify({ clusterName: 'test-cluster' }) }
    ]);

    const telemetryPayload: ClusterReport = { 
      resources: { 
        cpu: { capacity: '8', usage: '2' }, 
        memory: { capacity: '32', usage: '4' } 
      }, 
      fleets: [{ name: 'hub-fleet', replicas: 15, readyReplicas: 10, allocatedReplicas: 5 }],
      servers: [{ name: 'gs-01', state: 'Ready', address: '1.2.3.4', port: 7000 }]
    };

    const ingestionResult = await saveClusterReport(agentId, telemetryPayload, validToken);
    expect(ingestionResult.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();

    // Verify snapshot logic with status and servers
    mockSelectFromValues.mockResolvedValueOnce([
      { 
        id: agentId, 
        token: validToken, 
        status: 'connected',
        metadata: JSON.stringify({ clusterName: 'test-cluster' }),
        resources: JSON.stringify(telemetryPayload.resources),
        fleets: JSON.stringify(telemetryPayload.fleets),
        servers: JSON.stringify(telemetryPayload.servers),
        last_report_at: new Date()
      }
    ]);

    const snapshot = await getRegistrySnapshot();
    expect(snapshot[agentId].status).toBe('connected');
    expect(snapshot[agentId].servers).toHaveLength(1);
    expect(snapshot[agentId].servers?.[0].name).toBe('gs-01');
    expect(snapshot[agentId].lastReportTimestamp).toBeDefined();
  });
});
