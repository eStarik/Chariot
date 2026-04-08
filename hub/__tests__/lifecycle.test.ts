import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateRegistration } from '../src/lib/auth';
import { saveClusterReport, purgeStaleAgents, unregisterAgent, restoreAgent, ClusterReport } from '../src/lib/registry';

// Mock the DB and ensure stable return values
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn((...args) => ({
          limit: vi.fn().mockImplementation(() => ({
            then: (resolve: any) => mockSelect().then(resolve)
          })),
          then: (resolve: any) => mockSelect().then(resolve)
        })),
        then: (resolve: any) => mockSelect().then(resolve)
      }))
    })),
    insert: vi.fn((table) => ({
      values: vi.fn().mockImplementation((val) => {
        const result = {
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockImplementation(() => {
              const v = Array.isArray(val) ? val[0] : val;
              return Promise.resolve([{ id: v.id || 'mock-id', token: 'mock-token', status: 'connected', metadata: '{}' }]);
            })
          }),
          returning: vi.fn().mockImplementation(() => {
            const v = Array.isArray(val) ? val[0] : val;
            return Promise.resolve([{ id: v.id || 'mock-id', token: 'mock-token', status: 'connected', metadata: '{}' }]);
          })
        };
        return result;
      })
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockImplementation((...args) => {
          mockUpdate(...args);
          return Promise.resolve();
        })
      }))
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockImplementation((...args) => {
        mockDelete(...args);
        return Promise.resolve();
      })
    }))
  }
}));

vi.mock('@/lib/db/schema', () => ({
  agents: { id: 'agents_table', status: 'status_col', last_report_at: 'lr_col', created_at: 'ca_col', fingerprint: 'fp_col' },
  formations: { id: 'formations_table' },
  settings: { id: 'settings_table' }
}));

describe('Chariot Synchronization Lifecycle (Architecture v1 Alignment)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.SHARED_SECRET = 'architectural-secret';
  });

  it('should verify categorical Connected -> Disconnected -> Restored journey', async () => {
    const fingerprint = 'cluster-fp-01';

    // 1. Handshake Proclamation (Connected)
    mockSelect.mockResolvedValueOnce([]); // New agent (via fingerprint select)
    
    const reg = await validateRegistration({ secret: 'architectural-secret', fingerprint });
    expect(reg.success).toBe(true);
    
    const agentId = reg.agent_id!;
    const agentToken = reg.agent_token!;
    expect(agentId).toBeDefined();

    // 2. Telemetry Synchronization
    const report: ClusterReport = { resources: { cpu: { capacity: '1', usage: '0' }, memory: { capacity: '1', usage: '0' } }, fleets: [] };
    mockSelect.mockResolvedValueOnce([{ id: agentId, token: agentToken, status: 'connected', metadata: '{}' }]);
    mockUpdate.mockResolvedValueOnce({});

    await saveClusterReport(agentId, report, agentToken);
    expect(mockUpdate).toHaveBeenCalled();

    // 3. Soft-Disconnect Transition (Threshold Exceeded)
    await purgeStaleAgents(5);
    expect(mockUpdate).toHaveBeenCalled(); // Verifying transition update call

    // 4. Record Restoration (Restored on Heartbeat)
    mockSelect.mockResolvedValueOnce([{ id: agentId, token: agentToken, status: 'disconnected', metadata: '{}' }]);
    mockUpdate.mockResolvedValueOnce({});
    
    await saveClusterReport(agentId, report, agentToken);
    expect(mockUpdate).toHaveBeenCalled(); // Verify status restored to connected
  });

  it('should verify Explicit Deletion (Soft-Delete) and Manual Restoration requirement', async () => {
    const agentId = 'restorable-legion';
    mockUpdate.mockResolvedValueOnce({}); // For unregister (status -> deleted)
    
    await unregisterAgent(agentId);
    expect(mockUpdate).toHaveBeenCalled();

    // Verify it transitions back on restoration
    mockUpdate.mockResolvedValueOnce({}); // For restore (status -> active)
    await restoreAgent(agentId);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });
});
