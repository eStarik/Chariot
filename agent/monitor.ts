import * as k8s from '@kubernetes/client-node';
import YAML from 'yaml';

const kubeConfig = new k8s.KubeConfig();
kubeConfig.loadFromDefault();

const coreApi = kubeConfig.makeApiClient(k8s.CoreV1Api);
const customObjectsApi = kubeConfig.makeApiClient(k8s.CustomObjectsApi);

/**
 * Applies an Agones configuration (GameServer or Fleet) to the cluster.
 * Uses the CustomObjectsApi to create the resource in the target namespace.
 */
export async function applyAgonesConfiguration(yamlStr: string): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = YAML.parse(yamlStr);
    const group = 'agones.dev';
    const version = 'v1';
    const kind = parsed.kind;
    const plural = kind.toLowerCase() + 's';
    const namespace = parsed.metadata?.namespace || 'default';

    console.info(`[Monitor] Applying ${kind} "${parsed.metadata?.name}" to namespace "${namespace}"...`);

    try {
      // Attempt to create the resource
      await customObjectsApi.createNamespacedCustomObject({
        group,
        version,
        namespace,
        plural,
        body: parsed
      });

      // --- AUTOMATED EXPOSURE ---
      if (kind === 'GameServer') {
        await autoExposeGameServer(parsed);
      }
      
      return { success: true };
    } catch (createError: any) {
      // If it already exists, attempt to replace/patch it
      if (createError.response?.status === 409) {
        console.warn(`[Monitor] ${kind} already exists, attempting update...`);
        await customObjectsApi.replaceNamespacedCustomObject({
          group,
          version,
          namespace,
          plural,
          name: parsed.metadata.name,
          body: parsed
        });
        return { success: true };
      }
      throw createError;
    }
  } catch (error: any) {
    const msg = error.response?.body?.message || error.message;
    console.error('[Monitor] Deployment failed:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Automatically creates a LoadBalancer service for a GameServer to expose it.
 */
async function autoExposeGameServer(gs: any) {
  const name = gs.metadata.name;
  const ns = gs.metadata.namespace || 'default';
  
  // Find the primary port from GameServer spec
  const containerPort = gs.spec.ports?.[0]?.containerPort || gs.spec.template.spec.containers[0].ports?.[0]?.containerPort || 8080;
  
  console.info(`[Monitor] Auto-exposing GameServer "${name}" via LoadBalancer...`);
  
  const svcName = `${name}-exposure`;
  const serviceManifest = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name: svcName,
      namespace: ns,
      labels: {
        'chariot.dev/managed': 'true',
        'agones.dev/gameserver': name
      },
      ownerReferences: [
        {
          apiVersion: gs.apiVersion,
          kind: gs.kind,
          name: name,
          uid: gs.metadata?.uid,
          controller: true,
          blockOwnerDeletion: true
        }
      ]
    },
    spec: {
      type: 'LoadBalancer',
      selector: {
        'agones.dev/gameserver': name
      },
      ports: [
        {
          name: 'default',
          port: containerPort,
          targetPort: containerPort,
          protocol: 'UDP'
        }
      ]
    }
  };

  try {
    await coreApi.createNamespacedService({ namespace: ns, body: serviceManifest });
    console.info(`[Monitor] Exposure service created: ${svcName}`);
  } catch (err: any) {
    if (err.response?.status === 409) {
      console.warn(`[Monitor] Exposure service already exists for ${name}`);
    } else {
      console.error(`[Monitor] Failed to auto-expose ${name}:`, err.message);
    }
  }
}

export interface ClusterCapacity {
  cpuTotal: number;
  cpuUsed: number;
  ramTotal: number;
  ramUsed: number;
}

export interface FleetSummary {
  name: string;
  replicas: number;
  readyReplicas: number;
  allocatedReplicas: number;
}

/**
 * Retrieves the unique UID of the kube-system namespace as a cluster fingerprint.
 */
export async function getClusterFingerprint(): Promise<string> {
  try {
    const ns = await coreApi.readNamespace({ name: 'kube-system' });
    return ns.metadata?.uid || 'unknown-cluster-uid';
  } catch (error) {
    console.error('[Monitor] Failed to retrieve cluster fingerprint:', error instanceof Error ? error.message : error);
    return 'unknown-cluster-uid';
  }
}

/**
 * Aggregates cluster-wide resource capacity and current request-based usage.
 * Scans all nodes and running pods across all namespaces.
 */
export async function getClusterCapacity(): Promise<ClusterCapacity> {
  let cpuTotal = 0;
  let ramTotal = 0; // Unit: GiB
  let cpuUsed = 0;
  let ramUsed = 0; // Unit: GiB

  try {
    const nodes = await coreApi.listNode();
    for (const node of nodes.items) {
      const cpuValue = node.status?.capacity?.cpu || '0';
      const memValue = node.status?.capacity?.memory || '0Ki';
      
      cpuTotal += parseK8sCpu(cpuValue);
      ramTotal += parseK8sMemory(memValue);
    }
  } catch (err) {
    console.error('[Monitor] Failed to list nodes (RBAC?):', err instanceof Error ? err.message : err);
  }

  try {
    const pods = await coreApi.listPodForAllNamespaces();
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
  } catch (err) {
    console.error('[Monitor] Failed to list pods (RBAC?):', err instanceof Error ? err.message : err);
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
    const response = await customObjectsApi.listClusterCustomObject({
      group: 'agones.dev',
      version: 'v1',
      plural: 'fleets'
    }) as { items: any[] };
    
    for (const item of response.items) {
      const ns = item.metadata.namespace;
      if (targetNamespaces.includes(ns)) {
        summarizedFleets.push({
          name: item.metadata.name,
          replicas: item.spec?.replicas || 0,
          readyReplicas: item.status?.readyReplicas || 0,
          allocatedReplicas: item.status?.allocatedReplicas || 0
        });
      }
    }
  } catch (error) {
    console.error('[Monitor] Failed to retrieve Agones fleets:', error instanceof Error ? error.message : error);
  }

  return summarizedFleets;
}

/**
 * Discovers and summarizes individual Agones GameServer instances within specified namespaces.
 */
export async function getAgonesGameServerSummary(targetNamespaces: string[]): Promise<ServerStatus[]> {
  const servers: ServerStatus[] = [];
  
  try {
    const response = await customObjectsApi.listClusterCustomObject({
      group: 'agones.dev',
      version: 'v1',
      plural: 'gameservers'
    }) as { items: any[] };
    
    for (const item of response.items) {
      const ns = item.metadata.namespace;
      if (targetNamespaces.includes(ns)) {
        servers.push({
          name: item.metadata.name,
          state: item.status?.state || 'Unknown',
          address: item.status?.address || 'N/A',
          port: item.status?.ports?.[0]?.port || 0
        });
      }
    }
  } catch (error) {
    console.error('[Monitor] Failed to retrieve Agones GameServers:', error instanceof Error ? error.message : error);
  }

  return servers;
}

export interface ServerStatus {
  name: string;
  state: string;
  address: string;
  port: number;
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
