import { describe, it, expect, beforeEach } from 'vitest';
import { validateRegistration } from '../src/lib/auth';
import { saveClusterReport, getAgent, clearRegistry, ClusterReport } from '../src/lib/registry';

describe('Hub Secure Reporting (Authentication)', () => {
  let agentId: string;
  let agentToken: string;

  beforeEach(async () => {
    clearRegistry();
    process.env.SHARED_SECRET = 'chariot-secret-123';
    
    // Register an agent first to get valid credentials
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

    const ingestionResult = await saveClusterReport(agentId, telemetryPayload, agentToken);
    expect(ingestionResult.success).toBe(true);

    const updatedAgent = getAgent(agentId);
    expect(updatedAgent?.resources?.cpu.capacity).toBe('4');
  });

  it('should reject a report with an invalid token', async () => {
    const telemetryPayload: ClusterReport = { 
      resources: { cpu: { capacity: '4', usage: '1' }, memory: { capacity: '16', usage: '2' } }, 
      fleets: [] 
    };
    const ingestionResult = await saveClusterReport(agentId, telemetryPayload, 'wrong-token');
    
    expect(ingestionResult.success).toBe(false);
    expect(ingestionResult.error).toBe('Security violation: Unauthorized agent token');
  });

  it('should reject a report with an empty agent_id', async () => {
    const ingestionResult = await saveClusterReport('', {} as any, agentToken);
    expect(ingestionResult.success).toBe(false);
    expect(ingestionResult.error).toBe('Agent record not found');
  });

  it('should reject a report with a non-existent agent_id', async () => {
    const ingestionResult = await saveClusterReport('non-existent-uuid', {} as any, agentToken);
    expect(ingestionResult.success).toBe(false);
    expect(ingestionResult.error).toBe('Agent record not found');
  });
});
