import * as k8s from '@kubernetes/client-node';
import YAML from 'yaml';

export const kubeConfig = new k8s.KubeConfig();
kubeConfig.loadFromDefault();

const coreApi = kubeConfig.makeApiClient(k8s.CoreV1Api);
const customObjectsApi = kubeConfig.makeApiClient(k8s.CustomObjectsApi);
const isMockMode = process.env.CHARIOT_MOCK_AGONES === 'true';

// Internal state for Mock Mode
const mockGameservers = new Map<string, any>();
const mockFleets = new Map<string, any>();

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
      const createRes: any = await customObjectsApi.createNamespacedCustomObject({
        group,
        version,
        namespace,
        plural,
        body: parsed
      });
      const created = createRes.body || createRes;

      // --- AUTOMATED EXPOSURE ---
      if (kind === 'GameServer') {
        await autoExposeGameServer(created);
      }
      
      return { success: true };
    } catch (createError: any) {
      // If it already exists, attempt to replace/patch it
      if (createError.response?.status === 409) {
        console.warn(`[Monitor] ${kind} already exists, attempting update...`);
        const updateRes: any = await customObjectsApi.replaceNamespacedCustomObject({
          group,
          version,
          namespace,
          plural,
          name: parsed.metadata.name,
          body: parsed
        });
        const updated = updateRes.body || updateRes;
        
        if (kind === 'GameServer') {
          await autoExposeGameServer(updated);
        }
        
        return { success: true };
      }
      throw createError;
    }
  } catch (error: any) {
    if (isMockMode) {
      const parsed = YAML.parse(yamlStr);
      const name = parsed.metadata?.name || 'mock-unit';
      console.info(`[Monitor] [MOCK] Intercepted deployment for ${name}. Simulating success.`);
      
      if (parsed.kind === 'GameServer') {
        mockGameservers.set(name, {
          name,
          state: 'Ready',
          address: '127.0.0.1',
          port: 7777,
          usage: { cpu: '10m', memory: '32Mi', storage: '1Gi' }
        });
      }
      return { success: true };
    }

    const msg = error.response?.body?.message || error.message;
    console.error('[Monitor] Deployment failed:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Automatically creates a stable proxy entry for a GameServer.
 * 1. Creates a ClusterIP service for the GameServer (stable target).
 * 2. Updates NGINX Ingress TCP/UDP ConfigMap.
 * 3. Patches NGINX Controller Service to expose the proxy port.
 */
async function autoExposeGameServer(gs: any) {
  let actualGs = gs.body || gs;
  const name = actualGs.metadata.name;
  const ns = actualGs.metadata.namespace || 'default';

  if (!actualGs.metadata?.uid || actualGs.metadata.uid === '') {
    console.warn(`[Monitor] GameServer "${name}" is missing UID (value: "${actualGs.metadata?.uid}"), fetching full object...`);
    try {
      const gsRes: any = await customObjectsApi.getNamespacedCustomObject({
        group: 'agones.dev',
        version: 'v1',
        namespace: ns,
        plural: 'gameservers',
        name
      });
      actualGs = gsRes.body || gsRes;
    } catch (fetchErr) {
      console.error(`[Monitor] Failed to fetch full GameServer object:`, fetchErr);
    }
  }

  console.info(`[Monitor] Proceeding with GameServer UID: "${actualGs.metadata?.uid || 'MISSING'}"`);
  
  // Find the primary port and protocol from GameServer spec
  const specPort = actualGs.spec.ports?.[0];
  const containerPort = specPort?.containerPort || actualGs.spec.template.spec.containers[0].ports?.[0]?.containerPort || 8080;
  const protocol = (specPort?.protocol || 'UDP').toUpperCase();
  
  console.info(`[Monitor] Auto-exposing GameServer "${name}" via stable proxy (${protocol})...`);
  
  const internalSvcName = `${name}-internal`;
  const internalSvcManifest = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name: internalSvcName,
      namespace: ns,
      labels: {
        'chariot.dev/managed': 'true',
        'agones.dev/gameserver': name
      },
      ownerReferences: (actualGs.metadata?.uid && actualGs.metadata.uid !== '') ? [
        {
          apiVersion: actualGs.apiVersion || 'agones.dev/v1',
          kind: actualGs.kind || 'GameServer',
          name: name,
          uid: actualGs.metadata.uid,
          controller: true,
          blockOwnerDeletion: true
        }
      ] : []
    },
    spec: {
      type: 'ClusterIP',
      selector: {
        'agones.dev/gameserver': name
      },
      ports: [
        {
          name: 'default',
          port: containerPort,
          targetPort: containerPort,
          protocol: protocol
        }
      ]
    }
  };

  try {
    try {
      await coreApi.createNamespacedService({ namespace: ns, body: internalSvcManifest });
      console.info(`[Monitor] Internal ClusterIP service created: ${internalSvcName}`);
    } catch (svcErr: any) {
      if (svcErr.response?.status !== 409) throw svcErr;
    }

    const cmNamespace = 'ingress-nginx';
    const cmName = protocol === 'TCP' ? 'tcp-services' : 'udp-services';
    
    // Read the ConfigMap
    const cmRes: any = await coreApi.readNamespacedConfigMap({ name: cmName, namespace: cmNamespace });
    const cm = cmRes.body || cmRes;
    const data = cm.data || {};
    
    const entry = `${ns}/${internalSvcName}:${containerPort}`;
    let proxyPort = Object.keys(data).find(p => data[p] === entry);
    
    if (!proxyPort) {
      // Allocate a new port (30000-31000)
      let p = 30000;
      while (data[String(p)]) p++;
      proxyPort = String(p);
      data[proxyPort] = entry;
      
      await coreApi.replaceNamespacedConfigMap({ name: cmName, namespace: cmNamespace, body: { ...cm, data } });
      console.info(`[Monitor] Updated NGINX ${cmName} with port ${proxyPort}`);
    }

    // Patch NGINX Service to expose the port
    const nginxSvcRes: any = await coreApi.readNamespacedService({ name: 'ingress-nginx-controller', namespace: cmNamespace });
    const nginxSvc = nginxSvcRes.body || nginxSvcRes;
    const ports = nginxSvc.spec?.ports || [];
    
    if (!ports.find((p: any) => p.port === Number(proxyPort))) {
      ports.push({
        name: `game-${proxyPort}`,
        port: Number(proxyPort),
        targetPort: Number(proxyPort),
        protocol: protocol as any
      });
      
      // Update NGINX Service ports
      nginxSvc.spec.ports = ports;
      await coreApi.replaceNamespacedService({
        name: 'ingress-nginx-controller',
        namespace: cmNamespace,
        body: nginxSvc
      });
      console.info(`[Monitor] Exposed port ${proxyPort} on NGINX service`);
    }

    // Replace GameServer to update annotations
    const gsRes: any = await customObjectsApi.getNamespacedCustomObject({
      group: 'agones.dev',
      version: 'v1',
      namespace: ns,
      plural: 'gameservers',
      name: name
    });
    const gsObj = gsRes.body || gsRes;
    
    gsObj.metadata.annotations = gsObj.metadata.annotations || {};
    gsObj.metadata.annotations['chariot.dev/proxy-address'] = `localhost:${proxyPort}`;
    gsObj.metadata.annotations['chariot.dev/stable-port'] = proxyPort.toString();

    await customObjectsApi.replaceNamespacedCustomObject({
      group: 'agones.dev',
      version: 'v1',
      namespace: ns,
      plural: 'gameservers',
      name: name,
      body: gsObj
    });

    console.info(`[Monitor] GameServer "${name}" reachable via stable proxy at localhost:${proxyPort}`);
  } catch (err: any) {
    console.error(`[Monitor] Failed to auto-expose ${name}:`, err.response?.body?.message || err.message);
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

export interface ServerStatus {
  name: string;
  state: string;
  address: string;
  port: number;
  usage?: {
    cpu: string;
    memory: string;
    storage: string;
  };
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
  // Inject Mock Servers if in Mock Mode and bypass K8s to avoid Error states
  if (isMockMode) {
    return Array.from(mockGameservers.values());
  }

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
        // Fetch usage metrics if possible
        const usage = await getPodMetricsForGameServer(item.metadata.name, ns);
        const storage = await getPvcStatusForGameServer(item, ns);

        servers.push({
          name: item.metadata.name,
          state: item.status?.state || 'Unknown',
          address: item.status?.address || 'N/A',
          port: item.status?.ports?.[0]?.port || 0,
          usage: {
            cpu: usage.cpu,
            memory: usage.memory,
            storage: storage
          }
        });
      }
    }
  } catch (error) {
    console.error('[Monitor] Failed to retrieve Agones GameServers:', error instanceof Error ? error.message : error);
  }

  return servers;
}

/**
 * Fetches real-time CPU and RAM usage for the pod associated with a GameServer.
 */
async function getPodMetricsForGameServer(gsName: string, namespace: string) {
  try {
    // Note: This requires metrics-server to be installed in the cluster.
    // We attempt to find the pod with the label agones.dev/gameserver={gsName}
    const pods = await coreApi.listNamespacedPod({
      namespace,
      labelSelector: `agones.dev/gameserver=${gsName}`
    });

    if (pods.items.length === 0) return { cpu: '0m', memory: '0Mi' };

    const podName = pods.items[0].metadata?.name;
    if (!podName) return { cpu: '0m', memory: '0Mi' };

    // Use CustomObjectsApi for metrics.k8s.io
    const metrics: any = await customObjectsApi.getNamespacedCustomObject({
      group: 'metrics.k8s.io',
      version: 'v1beta1',
      namespace,
      plural: 'pods',
      name: podName
    });

    const container = metrics.containers?.[0];
    return {
      cpu: container?.usage?.cpu || '0m',
      memory: container?.usage?.memory || '0Mi'
    };
  } catch (e) {
    // Graceful fallback if metrics-server is missing
    return { cpu: 'REQ', memory: 'REQ' };
  }
}

/**
 * Checks for PVCs attached to the GameServer and returns their size/usage.
 */
async function getPvcStatusForGameServer(gs: any, namespace: string) {
  try {
    const volumes = gs.spec?.template?.spec?.volumes || [];
    const pvcVolume = volumes.find((v: any) => v.persistentVolumeClaim);
    
    if (!pvcVolume) return 'N/A';
    
    const pvcName = pvcVolume.persistentVolumeClaim.claimName;
    const pvc = await coreApi.readNamespacedPersistentVolumeClaim({ name: pvcName, namespace });
    
    const capacity = pvc.status?.capacity?.storage || 'Unknown';
    return capacity;
  } catch (e) {
    return 'ERR';
  }
}

/**
 * Streams logs for a specific GameServer pod.
 */
export async function streamGameServerLogs(gsName: string, namespace: string, outStream: any) {
  try {
    const pods = await coreApi.listNamespacedPod({
      namespace,
      labelSelector: `agones.dev/gameserver=${gsName}`
    });

    if (pods.items.length === 0) {
        outStream.write('ERROR: Pod for GameServer not found.\n');
        outStream.end();
        return;
    }

    const podName = pods.items[0].metadata?.name;
    if (!podName) return;

    const log = new k8s.Log(kubeConfig);
    await log.log(namespace, podName, 'server', outStream, { follow: true, tailLines: 100 });
  } catch (error: any) {
    outStream.write(`ERROR: Failed to stream logs: ${error.message}\n`);
    outStream.end();
  }
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
