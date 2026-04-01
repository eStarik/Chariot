import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
// We expect to implement these in agent/logic.js
// @ts-ignore
import { registerWithHub, loadConfig, saveConfig } from '../logic';

vi.mock('axios');
vi.mock('fs/promises');

describe('Agent Registration Logic (Persistent)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return agent_id and agent_token on first join', async () => {
    const mockResponse = { 
      data: { agent_id: 'test-uuid-123', agent_token: 'secure-token-abc' }, 
      status: 201 
    };
    (axios.post as any).mockResolvedValue(mockResponse);

    const result = await registerWithHub('http://hub-url', 'my-secret');
    expect(result.success).toBe(true);
    expect(result.agentId).toBe('test-uuid-123');
    expect(result.agentToken).toBe('secure-token-abc');
  });

  it('should include agent_id in request if already registered', async () => {
    const mockResponse = { 
      data: { agent_id: 'existing-uuid', agent_token: 'existing-token' }, 
      status: 201 
    };
    (axios.post as any).mockResolvedValue(mockResponse);

    const result = await registerWithHub('http://hub-url', 'my-secret', 'existing-uuid');
    
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/register'),
      expect.objectContaining({ agent_id: 'existing-uuid', secret: 'my-secret' })
    );
    expect(result.success).toBe(true);
  });
});
