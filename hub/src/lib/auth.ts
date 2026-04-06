import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { getAgent, registerAgent } from './registry';

/**
 * Result of an agent registration or re-connection attempt.
 */
export interface RegistrationResult {
  success: boolean;
  agent_id?: string;
  agent_token?: string;
  error?: string;
}

/**
 * Expected payload for initial or re-connection handshake.
 */
export interface RegistrationPayload {
  secret: string;
  agent_id?: string;
  metadata?: Record<string, any>;
}

/**
 * Validates agent registration against the system's SHARED_SECRET.
 * Handles both new registrations (generating IDs/Tokens) and 
 * re-connection logic for existing agents.
 */
export async function validateRegistration(payload: RegistrationPayload): Promise<RegistrationResult> {
  const { secret, agent_id, metadata } = payload;

  const systemSecret = process.env.SHARED_SECRET;
  if (!systemSecret || secret !== systemSecret) {
    return { success: false, error: 'Authorization failed: Invalid shared secret' };
  }

  // Handle existing agent re-connection
  if (agent_id) {
    const existingAgent = await getAgent(agent_id);
    if (existingAgent) {
      return {
        success: true,
        agent_id: existingAgent.agent_id,
        agent_token: existingAgent.agent_token
      };
    }
  }

  // Provision new agent identity
  const generatedId = uuidv4();
  const generatedToken = crypto.randomBytes(32).toString('hex');

  await registerAgent(generatedId, metadata || {}, generatedToken);

  return {
    success: true,
    agent_id: generatedId,
    agent_token: generatedToken
  };
}
