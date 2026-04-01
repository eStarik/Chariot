import * as k8s from '@kubernetes/client-node';

const kubeConfig = new k8s.KubeConfig();
kubeConfig.loadFromDefault();

const coreApi = kubeConfig.makeApiClient(k8s.CoreV1Api);
const customObjectsApi = kubeConfig.makeApiClient(k8s.CustomObjectsApi);

export interface ClusterCapacity {
  cpuTotal: number;
  cpuUsed: number;
  ramTotal: number;
  ramUsed: number;
}

export interface FleetSummary {
  fleetName: string;
  namespace: string;
  ready: number;
  allocated: number;
}

/**
 * Aggregates cluster-wide resource capacity and current request-based usage.
 * Scans all nodes and running pods across all namespaces.
 */
export async function getClusterCapacity(): Promise<ClusterCapacity> {
  // Fetch infrastructure state
  const { body: nodes } = await coreApi.listNode();
  const { body: pods } = await coreApi.listPodForAllNamespaces();

  let cpuTotal = 0;
  let ramTotal = 0; // Unit: GiB
  let cpuUsed = 0;
  let ramUsed = 0; // Unit: GiB

  // Accumulate node-level capacity
  for (const node of nodes.items) {
    const cpuValue = node.status?.capacity?.cpu || '0';
    const memValue = node.status?.capacity?.memory || '0Ki';
    
    cpuTotal += parseK8sCpu(cpuValue);
    ramTotal += parseK8sMemory(memValue);
  }

  // Accumulate pod-level resource requests (as a proxy for usage)
  for (const pod of pods.items) {
    if (pod.status?.phase === 'Running') {
      for (const container of pod.spec?.containers || []) {
        const cpuReq = container.resources?.requests?.cpu || '0';
        const memReq = container.resources?.requests?.memory || '0Ki';
        
        cpuUsed += parseK8sCpu(cpuReq);
        ramUsed += parseK8sMemory(memReq);
      }
    }
  }

  return {
    cpuTotal,
    ramTotal: Number(ramTotal.toFixed(2)),
    cpuUsed: Number(cpuUsed.toFixed(2)),
    ramUsed: Number(ramUsed.toFixed(2))
  };
}

/**
 * Discovers and summarizes Agones fleet health within specified namespaces.
 */
export async function getAgonesFleetSummary(targetNamespaces: string[]): Promise<FleetSummary[]> {
  const summarizedFleets: FleetSummary[] = [];
  
  try {
    // Agones CRDs follow the agones.dev/v1 group/version
    const response = await customObjectsApi.listClusterCustomObject('agones.dev', 'v1', 'fleets') as { body: { items: any[] } };
    
    for (const item of response.body.items) {
      const ns = item.metadata.namespace;
      if (targetNamespaces.includes(ns)) {
        summarizedFleets.push({
          fleetName: item.metadata.name,
          namespace: ns,
          ready: item.status?.readyReplicas || 0,
          allocated: item.status?.allocatedReplicas || 0
        });
      }
    }
  } catch (error) {
    console.error('[Monitor] Failed to retrieve Agones fleets:', error instanceof Error ? error.message : error);
  }

  return summarizedFleets;
}

/**
 * Standardizes K8s memory strings (e.g., '64Mi', '8Gi') into Gigabytes (GiB).
 */
function parseK8sMemory(memStr: string): number {
  const value = parseInt(memStr);
  if (memStr.endsWith('Gi') || memStr.endsWith('G')) return value;
  if (memStr.endsWith('Mi') || memStr.endsWith('M')) return value / 1024;
  if (memStr.endsWith('Ki') || memStr.endsWith('K')) return value / (1024 * 1024);
  return value / (1024 * 1024 * 1024); // Assume raw bytes
}

/**
 * Standardizes K8s CPU strings (e.g., '500m', '2') into core counts.
 */
function parseK8sCpu(cpuStr: string): number {
  if (cpuStr.endsWith('m')) {
    return parseInt(cpuStr) / 1000;
  }
  return parseInt(cpuStr);
}
