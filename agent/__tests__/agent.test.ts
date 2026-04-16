import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { registerWithHub, loadPersistentConfig } from '../logic';

const { mockCoreApi, mockCustomApi, mockReadNamespacedSecret, mockCreateNamespacedSecret, mockReplaceNamespacedSecret, mockReadNamespace } = vi.hoisted(() => {
  const coreApi = {
    readNamespacedSecret: vi.fn(),
    createNamespacedSecret: vi.fn(),
    replaceNamespacedSecret: vi.fn(),
    readNamespace: vi.fn().mockResolvedValue({ metadata: { uid: 'mock-cluster-id' } })
  };
  const customApi = {};
  return { 
    mockCoreApi: coreApi, 
    mockCustomApi: customApi,
    mockReadNamespacedSecret: coreApi.readNamespacedSecret,
    mockCreateNamespacedSecret: coreApi.createNamespacedSecret,
    mockReplaceNamespacedSecret: coreApi.replaceNamespacedSecret,
    mockReadNamespace: coreApi.readNamespace
  };
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
    CustomObjectsApi: class { static name = 'CustomObjectsApi'; },
  };
});

vi.mock('axios');

describe('Agent Identity Persistence (Kubernetes Secrets)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockReadNamespace.mockResolvedValue({ metadata: { uid: 'mock-cluster-id' } });
  });

  it('should successfully load persistent identity from cluster Secret', async () => {
    const mockAgentId = 'agent-007';
    const mockToken = 'quantum-token-123';
    
    mockReadNamespacedSecret.mockResolvedValueOnce({
      data: {
        agent_id: Buffer.from(mockAgentId).toString('base64'),
        agent_token: Buffer.from(mockToken).toString('base64')
      }
    });

    const config = await loadPersistentConfig();
    expect(config).not.toBeNull();
    expect(config?.agent_id).toBe(mockAgentId);
    expect(config?.agent_token).toBe(mockToken);
  });

  it('should provision and persist new identity into cluster Secret', async () => {
    const hubUrl = 'http://chariot-hub';
    const sharedSecret = 'handshake-secret';
    const newId = 'new-agent-uuid';
    const newToken = 'new-session-token';

    // 1. Mock Hub response
    (axios.post as any).mockResolvedValue({
      data: { success: true, agent_id: newId, agent_token: newToken }
    });

    // 2. Mock Secret upsert logic
    mockReplaceNamespacedSecret.mockResolvedValue({});

    const result = await registerWithHub(hubUrl, sharedSecret);

    expect(result.success).toBe(true);
    expect(result.agentId).toBe(newId);
    expect(mockReplaceNamespacedSecret).toHaveBeenCalledWith(expect.objectContaining({
      name: 'chariot-agent-identity',
      body: expect.objectContaining({
        data: {
          agent_id: Buffer.from(newId).toString('base64'),
          agent_token: Buffer.from(newToken).toString('base64')
        }
      })
    }));
  });
});
