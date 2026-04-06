import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateRegistration } from '../src/lib/auth';
import { saveClusterReport, getAgent, ClusterReport } from '../src/lib/registry';

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

describe('Hub Secure Reporting (Authentication)', () => {
  let agentId: string;
  let agentToken: string;

  beforeEach(async () => {
    vi.resetAllMocks();
    process.env.SHARED_SECRET = 'chariot-secret-123';
    
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

    // Register an agent first to get valid credentials
    // validateRegistration (with no agent_id) does NOT call getAgent
    const handshakeResult = await validateRegistration({ 
      secret: 'chariot-secret-123', 
      metadata: { clusterName: 'test-cluster' } 
    });
    agentId = handshakeResult.agent_id!;
    agentToken = handshakeResult.agent_token!;
  });

  it('should accept a report with valid credentials', async () => {
    const telemetryPayload: ClusterReport = { 
      resources: { 
        cpu: { capacity: '4', usage: '1' }, 
        memory: { capacity: '16', usage: '2' } 
      },
      fleets: []
    };

    // saveClusterReport (1st call to getAgent)
    mockLimit.mockResolvedValueOnce([
      { id: agentId, token: agentToken, metadata: '{}' }
    ]);

    const ingestionResult = await saveClusterReport(agentId, telemetryPayload, agentToken);
    expect(ingestionResult.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();

    // getAgent (2nd call to getAgent)
    mockLimit.mockResolvedValueOnce([
      { id: agentId, token: agentToken, metadata: '{}', resources: JSON.stringify(telemetryPayload.resources) }
    ]);

    const updatedAgent = await getAgent(agentId);
    expect(updatedAgent?.resources?.cpu.capacity).toBe('4');
  });

  it('should reject a report with an invalid token', async () => {
    const telemetryPayload: ClusterReport = { 
      resources: { cpu: { capacity: '4', usage: '1' }, memory: { capacity: '16', usage: '2' } }, 
      fleets: [] 
    };

    // saveClusterReport (1st call to getAgent)
    mockLimit.mockResolvedValueOnce([
      { id: agentId, token: agentToken, metadata: '{}' }
    ]);

    const ingestionResult = await saveClusterReport(agentId, telemetryPayload, 'wrong-token');
    
    expect(ingestionResult.success).toBe(false);
    expect(ingestionResult.error).toBe('Security violation: Unauthorized agent token');
  });

  it('should reject a report with an empty agent_id', async () => {
    // saveClusterReport (1st call to getAgent with dummy ID or empty)
    mockLimit.mockResolvedValueOnce([]); 

    const ingestionResult = await saveClusterReport('', {} as any, agentToken);
    expect(ingestionResult.success).toBe(false);
    expect(ingestionResult.error).toBe('Agent record not found');
  });

  it('should reject a report with a non-existent agent_id', async () => {
    // saveClusterReport (1st call to getAgent)
    mockLimit.mockResolvedValueOnce([]); 

    const ingestionResult = await saveClusterReport('non-existent-uuid', {} as any, agentToken);
    expect(ingestionResult.success).toBe(false);
    expect(ingestionResult.error).toBe('Agent record not found');
  });
});
