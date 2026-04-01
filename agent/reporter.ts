import axios from 'axios';

export interface ReportResult {
  success: boolean;
  error?: string;
}

/**
 * Pushes the cluster resource and Agones fleet reports to the Chariot Hub.
 * @param hubUrl The base URL of the Chariot Hub
 * @param agentId The persistent agent ID
 * @param agentToken The secure agent token
 * @param data The resource and fleet metadata
 */
export async function pushReportToHub(
  hubUrl: string, 
  agentId: string, 
  agentToken: string, 
  data: any
): Promise<ReportResult> {
  try {
    const response = await axios.post(`${hubUrl}/api/v1/report`, data, {
      headers: {
        'X-Agent-ID': agentId,
        'X-Agent-Token': agentToken
      }
    });

    if (response.status === 200) {
      return { success: true };
    }

    return { success: false, error: `Unexpected status code: ${response.status}` };
  } catch (error: any) {
    if (error.response) {
      return {
        success: false,
        error: error.response.data?.error || 'Reporting failed'
      };
    }
    return { success: false, error: error.message };
  }
}
