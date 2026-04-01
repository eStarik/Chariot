import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
// We expect to implement this in agent/reporter.ts
// @ts-ignore
import { pushReportToHub } from '../reporter';

vi.mock('axios');

describe('Agent Secure Reporting (Push)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should include X-Agent-ID and X-Agent-Token in the headers', async () => {
    const mockResponse = { data: { success: true }, status: 200 };
    (axios.post as any).mockResolvedValue(mockResponse);

    const reportData = { 
      resources: { cpuTotal: 4, cpuUsed: 1, ramTotal: 16, ramUsed: 2 },
      fleets: [] 
    };

    const agentId = 'agent-123';
    const agentToken = 'token-456';

    const result = await pushReportToHub('http://hub-url', agentId, agentToken, reportData);
    
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/report'),
      reportData,
      expect.objectContaining({
        headers: {
          'X-Agent-ID': agentId,
          'X-Agent-Token': agentToken
        }
      })
    );
    expect(result.success).toBe(true);
  });

  it('should return failure if the Hub rejects the report', async () => {
    const mockError = { response: { status: 401, data: { error: 'Invalid token' } } };
    (axios.post as any).mockRejectedValue(mockError);

    const result = await pushReportToHub('http://hub-url', 'id', 'token', {});
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid token');
  });

  it('should explicitly identify a 401 Unauthorized for re-registration logic', async () => {
    const mockError = { response: { status: 401, data: { error: 'Unauthorized' } } };
    (axios.post as any).mockRejectedValue(mockError);

    const result = await pushReportToHub('http://hub-url', 'invalid-id', 'invalid-token', {});
    
    // This result should allow the caller (index.js) to trigger registerWithHub()
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });
});
