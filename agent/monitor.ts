import * as k8s from '@kubernetes/client-node';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const customApi = kc.makeApiClient(k8s.CustomObjectsApi);

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
 * Fetches the total and current requested CPU/RAM of the cluster nodes.
 */
export async function getClusterCapacity(): Promise<ClusterCapacity> {
  const nodes = await k8sApi.listNode();
  const pods = await k8sApi.listPodForAllNamespaces();

  let cpuTotal = 0;
  let ramTotal = 0; // In GiB
  let cpuUsed = 0;
  let ramUsed = 0; // In GiB

  // Sum node capacities
  for (const node of nodes.body.items) {
    const cpu = node.status?.capacity?.cpu || '0';
    const mem = node.status?.capacity?.memory || '0Ki';
    
    cpuTotal += parseInt(cpu);
    ramTotal += parseK8sMemory(mem);
  }

  // Sum pod resource requests
  for (const pod of pods.body.items) {
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
    ramTotal: Math.round(ramTotal * 100) / 100,
    cpuUsed: Math.round(cpuUsed * 100) / 100,
    ramUsed: Math.round(ramUsed * 100) / 100
  };
}

/**
 * Fetches the status of Agones fleets in the specified namespaces.
 */
export async function getAgonesFleetSummary(namespaces: string[]): Promise<FleetSummary[]> {
  const fleets: FleetSummary[] = [];
  
  try {
    const response: any = await customApi.listClusterCustomObject('agones.dev', 'v1', 'fleets');
    
    for (const item of response.body.items) {
      if (namespaces.includes(item.metadata.namespace)) {
        fleets.push({
          fleetName: item.metadata.name,
          namespace: item.metadata.namespace,
          ready: item.status?.readyReplicas || 0,
          allocated: item.status?.allocatedReplicas || 0
        });
      }
    }
  } catch (err) {
    console.error('Error fetching Agones fleets:', err);
  }

  return fleets;
}

// Utility functions for K8s unit conversion
function parseK8sMemory(memStr: string): number {
  const unit = memStr.slice(-2);
  const value = parseInt(memStr);
  if (unit === 'Gi') return value;
  if (unit === 'Mi') return value / 1024;
  if (unit === 'Ki') return value / (1024 * 1024);
  const singleUnit = memStr.slice(-1);
  if (singleUnit === 'G') return value;
  if (singleUnit === 'M') return value / 1024;
  return value / (1024 * 1024 * 1024);
}

function parseK8sCpu(cpuStr: string): number {
  if (cpuStr.endsWith('m')) {
    return parseInt(cpuStr) / 1000;
  }
  return parseInt(cpuStr);
}
