import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { getAgent, registerAgent } from './registry';

export interface RegistrationResult {
  success: boolean;
  agent_id?: string;
  agent_token?: string;
  error?: string;
}

/**
 * Validates an agent registration request against the shared secret and handles persistent IDs.
 * @param payload The request body containing the secret, agent_id (optional), and metadata
 * @returns RegistrationResult
 */
export async function validateRegistration(payload: any): Promise<RegistrationResult> {
  const { secret, agent_id, metadata } = payload;

  if (!secret) {
    return { success: false, error: 'Missing shared secret' };
  }

  const expectedSecret = process.env.SHARED_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return { success: false, error: 'Invalid shared secret' };
  }

  // Handle re-connection
  if (agent_id) {
    const existingAgent = getAgent(agent_id);
    if (existingAgent) {
      // For re-connection, we return the same ID and Token
      return {
        success: true,
        agent_id: existingAgent.agent_id,
        agent_token: existingAgent.agent_token
      };
    }
  }

  // Initial Registration
  const new_agent_id = uuidv4();
  const new_agent_token = crypto.randomBytes(32).toString('hex');

  registerAgent(new_agent_id, metadata, new_agent_token);

  return {
    success: true,
    agent_id: new_agent_id,
    agent_token: new_agent_token
  };
}
