import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

const PERSISTENT_CONFIG_PATH = path.join(process.cwd(), 'agent.config.json');

export interface RegistrationResult {
  success: boolean;
  agentId?: string;
  agentToken?: string;
  error?: string;
}

export interface AgentConfig {
  agent_id: string;
  agent_token: string;
}

export interface HandshakePayload {
  secret: string;
  agent_id?: string;
  metadata: {
    clusterName: string;
    [key: string]: any;
  };
}

/**
 * Initiates the identity handshake with the central Chariot Hub.
 * If an existingAgentId is provided, the Hub will attempt to resume the session.
 */
export async function registerWithHub(hubUrl: string, secret: string, existingAgentId?: string): Promise<RegistrationResult> {
  try {
    const handshakePayload: HandshakePayload = {
      secret,
      metadata: {
        clusterName: process.env.CLUSTER_NAME || 'unknown-cluster'
      }
    };

    if (existingAgentId) {
      handshakePayload.agent_id = existingAgentId;
    }

    const hubResponse = await axios.post(`${hubUrl}/api/v1/register`, handshakePayload, { timeout: 10000 });

    if (hubResponse.status === 201) {
      const { agent_id, agent_token } = hubResponse.data;
      
      // Persist provisioned identifiers locally for resume support
      await savePersistentConfig({ agent_id, agent_token });

      return {
        success: true,
        agentId: agent_id,
        agentToken: agent_token
      };
    }

    return { success: false, error: `Hub rejected registration with status: ${hubResponse.status}` };
  } catch (error: any) {
    if (error.response) {
      return {
        success: false,
        error: error.response.data?.error || 'Hub registration handshake failed'
      };
    }
    return { success: false, error: `Handshake network error: ${error.message}` };
  }
}

/**
 * Loads the agent's identity configuration from the local filesystem.
 */
export async function loadPersistentConfig(): Promise<AgentConfig | null> {
  try {
    const rawData = await fs.readFile(PERSISTENT_CONFIG_PATH, 'utf-8');
    return JSON.parse(rawData) as AgentConfig;
  } catch (error) {
    return null; // Config missing or unreadable
  }
}

/**
 * Persists the agent's identity configuration to the local filesystem.
 */
export async function savePersistentConfig(config: AgentConfig): Promise<void> {
  try {
    await fs.writeFile(PERSISTENT_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Config] Critical error: Failed to persist agent configuration:', error);
  }
}
