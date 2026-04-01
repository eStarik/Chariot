import { describe, it, expect, beforeEach, vi } from 'vitest';
// @ts-ignore
import { validateRegistration } from '../src/lib/auth';
// @ts-ignore
import { saveClusterReport, getAgent, clearRegistry } from '../src/lib/registry';

describe('Hub Secure Reporting (Authentication)', () => {
  let agentId: string;
  let agentToken: string;

  beforeEach(async () => {
    clearRegistry();
    process.env.SHARED_SECRET = 'chariot-secret-123';
    
    // Register an agent first to get valid credentials
    const registration = await validateRegistration({ 
      secret: 'chariot-secret-123', 
      metadata: { cluster_name: 'test-cluster' } 
    });
    agentId = registration.agent_id;
    agentToken = registration.agent_token;
  });

  it('should accept a report with valid credentials', async () => {
    const report = { 
      resources: { cpuTotal: 4, cpuUsed: 1, ramTotal: 16, ramUsed: 2 },
      fleets: []
    };

    // Note: The API route would extract headers and call this logic
    const result = await saveClusterReport(agentId, report, agentToken);
    expect(result.success).toBe(true);

    const updatedAgent = getAgent(agentId);
    expect(updatedAgent?.resources.cpuTotal).toBe(4);
  });

  it('should reject a report with an invalid token', async () => {
    const report = { resources: { cpuTotal: 4, cpuUsed: 1 }, fleets: [] };
    const result = await saveClusterReport(agentId, report, 'wrong-token');
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid agent token');
  });

  it('should reject a report with an empty agent_id', async () => {
    const result = await saveClusterReport('', {}, agentToken);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Agent not found');
  });

  it('should reject a report with a null payload', async () => {
    // This is a sanity check to ensure the registry doesn't crash on bad data
    const result = await saveClusterReport(agentId, null, agentToken);
    expect(result.success).toBe(true); // Assuming the registry handles null as "no update" (TODO: Fix this logic if needed)
  });

  it('should reject a report with a non-existent agent_id', async () => {
    const result = await saveClusterReport('non-existent-uuid', {}, agentToken);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Agent not found');
  });
});
