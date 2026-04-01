import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { registerWithHub, loadPersistentConfig, savePersistentConfig } from '../logic';

vi.mock('axios');
vi.mock('fs/promises');

describe('Agent Registration Logic (Persistent)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return agent_id and agent_token on first join', async () => {
    const mockHubResponse = { 
      data: { agent_id: 'test-uuid-123', agent_token: 'secure-token-abc' }, 
      status: 201 
    };
    (axios.post as any).mockResolvedValue(mockHubResponse);

    const identityResult = await registerWithHub('http://hub-url', 'my-secret');
    
    expect(identityResult.success).toBe(true);
    expect(identityResult.agentId).toBe('test-uuid-123');
    expect(identityResult.agentToken).toBe('secure-token-abc');
  });

  it('should include agent_id in request if already registered', async () => {
    const mockHubResponse = { 
      data: { agent_id: 'existing-uuid', agent_token: 'existing-token' }, 
      status: 201 
    };
    (axios.post as any).mockResolvedValue(mockHubResponse);

    const identityResult = await registerWithHub('http://hub-url', 'my-secret', 'existing-uuid');
    
    // Verify parameters align with the refined HandshakePayload structure
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/register'),
      expect.objectContaining({ 
        agent_id: 'existing-uuid', 
        secret: 'my-secret',
        metadata: expect.objectContaining({
          clusterName: expect.any(String)
        })
      }),
      expect.objectContaining({
        timeout: 10000
      })
    );
    expect(identityResult.success).toBe(true);
  });
});
