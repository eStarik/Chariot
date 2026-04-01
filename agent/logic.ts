import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'agent.config.json');

export interface RegistrationResult {
  success: boolean;
  agentId?: string;
  agentToken?: string;
  error?: string;
}

/**
 * Registers the agent with the central Chariot Hub.
 * @param hubUrl The base URL of the Chariot Hub
 * @param secret The shared secret for authentication
 * @param existingAgentId The persistent agent ID if already registered
 */
export async function registerWithHub(hubUrl: string, secret: string, existingAgentId?: string): Promise<RegistrationResult> {
  try {
    const payload: any = {
      secret,
      metadata: {
        cluster_name: process.env.CLUSTER_NAME || 'unknown-cluster'
      }
    };

    if (existingAgentId) {
      payload.agent_id = existingAgentId;
    }

    const response = await axios.post(`${hubUrl}/api/v1/register`, payload);

    if (response.status === 201) {
      const { agent_id, agent_token } = response.data;
      
      // Persist locally
      await saveConfig({ agent_id, agent_token });

      return {
        success: true,
        agentId: agent_id,
        agentToken: agent_token
      };
    }

    return { success: false, error: 'Unexpected status code' };
  } catch (error: any) {
    if (error.response) {
      return {
        success: false,
        error: error.response.data?.error || 'Registration failed'
      };
    }
    return { success: false, error: error.message };
  }
}

export async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

export async function saveConfig(config: any) {
  try {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save config:', error);
  }
}
