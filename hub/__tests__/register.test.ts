import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateRegistration } from '../src/lib/auth';
import { getAgent } from '../src/lib/registry';

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

describe('Agent Registration Protocol (Secure)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Re-establish default implementations after reset
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

  it('should return a persistent ID and a secure token on first join', async () => {
    process.env.SHARED_SECRET = 'chariot-secret-123';
    
    const handshakePayload = { 
      secret: 'chariot-secret-123',
      metadata: { clusterName: 'prod-cluster' } 
    };

    // New registration happens (agent_id undefined in payload, validateRegistration skips getAgent)
    const handshakeResult = await validateRegistration(handshakePayload);
    expect(handshakeResult.success).toBe(true);
    expect(handshakeResult.agent_id).toBeDefined();
    expect(handshakeResult.agent_token).toBeDefined();
    expect(mockInsert).toHaveBeenCalled();
  });

  it('should reject registration if the shared secret is wrong', async () => {
    process.env.SHARED_SECRET = 'chariot-secret-123';
    
    const handshakePayload = { 
      secret: 'wrong-secret',
      metadata: { clusterName: 'evil-cluster' } 
    };

    const handshakeResult = await validateRegistration(handshakePayload);
    expect(handshakeResult.success).toBe(false);
    expect(handshakeResult.error).toBe('Authorization failed: Invalid shared secret');
    
    // VERIFY: Registry should not contain this evil agent
    mockLimit.mockResolvedValueOnce([]); // getAgent lookup
    const persistedAgent = await getAgent(handshakeResult.agent_id as string);
    expect(persistedAgent).toBeUndefined();
  });

  it('should allow re-connection with existing agent_id and return the same token', async () => {
    process.env.SHARED_SECRET = 'chariot-secret-123';
    
    const existingId = 'ca911748-9cd5-408c-9b16-917cf1983784';
    const existingToken = 'eb12fb874c22a280ce4500511481739b445972354d5064ef094c1b13818e8a31';
    
    // Re-registration mock
    mockLimit.mockResolvedValueOnce([
      { id: existingId, token: existingToken, metadata: JSON.stringify({ clusterName: 'persistent-cluster' }) }
    ]);

    const reConnect = await validateRegistration({ 
      secret: 'chariot-secret-123', 
      agent_id: existingId,
      metadata: { clusterName: 'persistent-cluster' } 
    });

    expect(reConnect.success).toBe(true);
    expect(reConnect.agent_id).toBe(existingId);
    expect(reConnect.agent_token).toBe(existingToken);
  });
});
