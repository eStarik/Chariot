import axios from 'axios';
import { getClusterFingerprint } from './monitor';
import * as k8s from '@kubernetes/client-node';

const kubeConfig = new k8s.KubeConfig();
kubeConfig.loadFromDefault();
const coreApi = kubeConfig.makeApiClient(k8s.CoreV1Api);

const IDENTITY_SECRET_NAME = 'chariot-agent-identity';
const DEFAULT_NAMESPACE = process.env.POD_NAMESPACE || 'default';

export interface HandshakePayload {
  secret: string;
  agent_id?: string;
  fingerprint?: string;
  metadata: {
    clusterName: string;
    [key: string]: any;
  };
}

export interface RegistrationResult {
  success: boolean;
  agentId?: string;
  agentToken?: string;
  error?: string;
}

/**
 * Attempts to load persistent identity (agent_id and token) from a Kubernetes Secret.
 * This foundationally ensures persistence across pod restarts without local volumes.
 * 
 * @returns Object containing agent_id and agent_token if successful, otherwise null.
 */
export async function loadPersistentConfig(): Promise<{ agent_id: string; agent_token: string } | null> {
  try {
    const response = await coreApi.readNamespacedSecret({
      name: IDENTITY_SECRET_NAME, 
      namespace: DEFAULT_NAMESPACE 
    });
    
    if (!response.data || !response.data.agent_id || !response.data.agent_token) return null;
    
    return {
      agent_id: Buffer.from(response.data.agent_id, 'base64').toString(),
      agent_token: Buffer.from(response.data.agent_token, 'base64').toString()
    };
  } catch (error) {
    return null;
  }
}

/**
 * Persists registration identity into a Kubernetes Secret.
 * Synchronizes the monitor's identity with the cluster control plane to ensure 
 * survivability during pod eviction or updates.
 * 
 * @param agentId The persistent identifier granted by the Hub.
 * @param agentToken The secure access token granted by the Hub.
 */
async function savePersistentConfig(agentId: string, agentToken: string): Promise<void> {
  const secretData = {
    agent_id: Buffer.from(agentId).toString('base64'),
    agent_token: Buffer.from(agentToken).toString('base64')
  };

  try {
    // Attempt update first
    await coreApi.replaceNamespacedSecret({
      name: IDENTITY_SECRET_NAME,
      namespace: DEFAULT_NAMESPACE,
      body: {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: { name: IDENTITY_SECRET_NAME },
        data: secretData,
        type: 'Opaque'
      }
    });
  } catch (err: any) {
    // Diagnostic logging for persistence troubleshooting
    console.debug('[Auth] Secret update failed, analyzing error object...');
    
    let statusCode = err.response?.statusCode || err.statusCode;
    let reason = err.body?.reason || err.reason;
    let message = err.body?.message || err.message || '';

    // Handle case where body is a JSON string or contains the error info
    const bodyStr = typeof err.body === 'string' ? err.body : JSON.stringify(err.body || {});
    
    if (!statusCode) {
      if (bodyStr.includes('"code":404') || bodyStr.includes('NotFound') || message.includes('404') || message.includes('not found')) {
        statusCode = 404;
        reason = 'NotFound';
      }
    }

    const isNotFound = statusCode === 404 || reason === 'NotFound' || message.includes('not found');

    if (isNotFound) {
      console.info(`[Auth] Identity secret "${IDENTITY_SECRET_NAME}" not found. Creating new secret...`);
      try {
        await coreApi.createNamespacedSecret({
          namespace: DEFAULT_NAMESPACE,
          body: {
            apiVersion: 'v1',
            kind: 'Secret',
            metadata: { name: IDENTITY_SECRET_NAME },
            data: secretData,
            type: 'Opaque'
          }
        });
        console.info('[Auth] Identity secret created successfully.');
      } catch (createErr: any) {
        console.error('[Auth] Failed to create identity secret:', createErr.response?.body?.message || createErr.message);
        throw createErr;
      }
    } else {
      console.error('[Auth] Failed to update identity secret. Full Error Details:');
      console.error(`- Status Code: ${statusCode}`);
      console.error(`- Reason: ${reason}`);
      console.error(`- Message: ${message}`);
      console.error(`- Body Snippet: ${bodyStr.substring(0, 200)}`);
      throw err;
    }
  }
}

/**
 * Orchestrates the registration handshake with the Hub coordinator.
 * Exchanges the shared secret and cluster fingerprint for a unique Legion identity.
 * 
 * @param hubUrl The base URL of the Hub service.
 * @param secret The platform-wide Shared Secret.
 * @param existingAgentId Optional ID to attempt re-authentication if known.
 * @returns Success status and the newly acquired identity details.
 */
export async function registerWithHub(hubUrl: string, secret: string, existingAgentId?: string): Promise<RegistrationResult> {
  try {
    const fingerprint = await getClusterFingerprint();
    const handshakePayload: HandshakePayload = {
      secret,
      fingerprint,
      metadata: {
        clusterName: process.env.CLUSTER_NAME || 'unknown-cluster'
      }
    };

    if (existingAgentId) {
      handshakePayload.agent_id = existingAgentId;
    }

    const hubResponse = await axios.post(`${hubUrl}/api/v1/register`, handshakePayload, { timeout: 10000 });

    if (hubResponse.data.success) {
      const { agent_id, agent_token } = hubResponse.data;
      await savePersistentConfig(agent_id, agent_token);
      return { success: true, agentId: agent_id, agentToken: agent_token };
    } else {
      console.error('[Auth] registration handshake failed with data:', JSON.stringify(hubResponse.data));
      return { success: false, error: hubResponse.data.error || 'Hub registration handshake failed' };
    }
  } catch (error: any) {
    if (error.response) {
      console.error('[Auth] registration handshake failed with status:', error.response.status, 'data:', JSON.stringify(error.response.data));
    } else {
      console.error('[Auth] registration handshake failed with error:', error.message);
    }
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
