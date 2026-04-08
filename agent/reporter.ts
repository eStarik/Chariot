import axios from 'axios';

/**
 * Standard Fleet and Resource usage metrics.
 * Must align with Hub's ClusterReport interface.
 */
export interface ClusterReport {
  resources: {
    cpu: { capacity: string; usage: string };
    memory: { capacity: string; usage: string };
  };
  fleets: Array<{
    name: string;
    replicas: number;
    readyReplicas: number;
    allocatedReplicas: number;
  }>;
  servers?: Array<{
    name: string;
    state: string;
    address: string;
    port: number;
  }>;
}

export interface ReportResult {
  success: boolean;
  error?: string;
  isUnauthorized?: boolean;
}

/**
 * Pushes validated cluster telemetry to the Chariot Hub.
 * Handles authentication headers and structured error recovery.
 */
export async function pushReportToHub(
  hubUrl: string, 
  agentId: string, 
  agentToken: string, 
  telemetryPayload: ClusterReport
): Promise<ReportResult> {
  try {
    const hubResponse = await axios.post(`${hubUrl}/api/v1/report`, telemetryPayload, {
      headers: {
        'X-Agent-ID': agentId,
        'X-Agent-Token': agentToken
      },
      timeout: 5000 // 5s timeout for reporting
    });

    if (hubResponse.status === 200) {
      return { success: true };
    }

    return { success: false, error: `Hub returned unexpected status: ${hubResponse.status}` };
  } catch (error: any) {
    if (error.response) {
      const isUnauthorized = error.response.status === 401;
      return {
        success: false,
        isUnauthorized,
        error: error.response.data?.error || 'Telemetry ingestion failed'
      };
    }
    return { success: false, error: `Network or internal error: ${error.message}` };
  }
}
