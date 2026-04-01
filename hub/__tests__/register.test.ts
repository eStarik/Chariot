import { describe, it, expect } from 'vitest';
import { validateRegistration } from '../src/lib/auth';
import { getAgent } from '../src/lib/registry';

describe('Agent Registration Protocol (Secure)', () => {
  it('should return a persistent ID and a secure token on first join', async () => {
    process.env.SHARED_SECRET = 'chariot-secret-123';
    
    const handshakePayload = { 
      secret: 'chariot-secret-123',
      metadata: { clusterName: 'prod-cluster' } 
    };

    const handshakeResult = await validateRegistration(handshakePayload);
    expect(handshakeResult.success).toBe(true);
    expect(handshakeResult.agent_id).toBeDefined();
    expect(handshakeResult.agent_token).toBeDefined();
    expect(handshakeResult.agent_token!.length).toBeGreaterThan(16);
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
    const persistedAgent = getAgent(handshakeResult.agent_id as string);
    expect(persistedAgent).toBeUndefined();
  });

  it('should allow re-connection with existing agent_id and return the same token', async () => {
    process.env.SHARED_SECRET = 'chariot-secret-123';
    const firstJoin = await validateRegistration({ 
      secret: 'chariot-secret-123', 
      metadata: { clusterName: 'persistent-cluster' } 
    });
    
    const reConnect = await validateRegistration({ 
      secret: 'chariot-secret-123', 
      agent_id: firstJoin.agent_id,
      metadata: { clusterName: 'persistent-cluster' } 
    });

    expect(reConnect.success).toBe(true);
    expect(reConnect.agent_id).toBe(firstJoin.agent_id);
    expect(reConnect.agent_token).toBe(firstJoin.agent_token);
  });
});
