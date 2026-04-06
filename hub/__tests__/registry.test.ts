import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveClusterReport, getRegistrySnapshot, registerAgent, ClusterReport } from '../src/lib/registry';

// Global mock references
const mockLimit = vi.fn();
const mockSelectFromValues = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: mockLimit })),
        limit: mockLimit,
        then: (resolve: any) => mockSelectFromValues().then(resolve),
      }))
    })),
    insert: vi.fn((...args) => mockInsert(...args)),
    update: vi.fn((...args) => mockUpdate(...args)),
  }
}));

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
    mockUpdate.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) });
    mockInsert.mockImplementation((table) => ({
      values: vi.fn().mockImplementation((v) => ({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: v.id || 'test-id', token: v.token || 'test-token', metadata: v.metadata || '{}' }])
        }),
        returning: vi.fn().mockResolvedValue([{ id: v.id || 'test-id', token: v.token || 'test-token', metadata: v.metadata || '{}' }])
      }))
    }));
  });

  const validToken = 'secure-test-token-123';

  it('should reject reports from unknown agents', async () => {
    const telemetryPayload: ClusterReport = { 
      resources: { cpu: { capacity: '4', usage: '1' }, memory: { capacity: '16', usage: '2' } }, 
      fleets: [] 
    };
    
    mockLimit.mockResolvedValueOnce([]); // Simulate agent not found

    const ingestionResult = await saveClusterReport('unknown-id', telemetryPayload, validToken);
    
    expect(ingestionResult.success).toBe(false);
    expect(ingestionResult.error).toBe('Agent record not found');
  });

  it('should successfully update an agent record with new metrics', async () => {
    const agentId = 'test-agent-001';
    
    // Simulate finding the agent during reporting
    mockLimit.mockResolvedValueOnce([
      { id: agentId, token: validToken, metadata: JSON.stringify({ clusterName: 'test-cluster' }) }
    ]);

    const telemetryPayload: ClusterReport = { 
      resources: { 
        cpu: { capacity: '8', usage: '2' }, 
        memory: { capacity: '32', usage: '4' } 
      }, 
      fleets: [{ name: 'hub-fleet', replicas: 15, readyReplicas: 10, allocatedReplicas: 5 }] 
    };

    const ingestionResult = await saveClusterReport(agentId, telemetryPayload, validToken);
    expect(ingestionResult.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();

    // Verify snapshot logic
    mockSelectFromValues.mockResolvedValueOnce([
      { 
        id: agentId, 
        token: validToken, 
        metadata: JSON.stringify({ clusterName: 'test-cluster' }),
        resources: JSON.stringify(telemetryPayload.resources),
        fleets: JSON.stringify(telemetryPayload.fleets),
        last_report_at: new Date()
      }
    ]);

    const snapshot = await getRegistrySnapshot();
    expect(snapshot[agentId].resources?.cpu.capacity).toBe('8');
    expect(snapshot[agentId].fleets).toHaveLength(1);
    expect(snapshot[agentId].lastReportTimestamp).toBeDefined();
  });
});
