import 'dotenv/config';
import { registerWithHub, loadPersistentConfig } from './logic';
import { pushReportToHub, ClusterReport } from './reporter';
import http from 'http';
import { parse } from 'url';
import { WebSocketServer } from 'ws';
import { handleTerminalSession } from './terminal_handler';
import { getAgonesGameServerSummary, getClusterCapacity, getAgonesFleetSummary, applyAgonesConfiguration, streamGameServerLogs } from './monitor';

const HUB_URL = process.env.HUB_URL || 'http://localhost:3000';
const SHARED_SECRET = process.env.SHARED_SECRET;
const REPORT_INTERVAL = 2000; // 2s for rapid verification
const NAMESPACES = (process.env.NAMESPACES || 'default,chariot-hoplites').split(',');
const LOG_SERVER_PORT = parseInt(process.env.LOG_SERVER_PORT || '3001');

async function startAgent() {
  if (!SHARED_SECRET) {
    console.error('[Fatal] CRITICAL: SHARED_SECRET environment variable is missing.');
    process.exit(1);
  }

  console.info('--- Chariot Agent Service Initialization ---');

  // Attempt to recover existing identity from local cache
  const localIdentity = await loadPersistentConfig();
  let agentId = localIdentity?.agent_id;
  let agentToken = localIdentity?.agent_token;

  console.info(`[Auth] Identity Mode: ${agentId ? 'Resuming Session' : 'Initial Handshake'}`);

  const identityResult = await registerWithHub(HUB_URL, SHARED_SECRET, agentId);

  if (identityResult.success) {
    agentId = identityResult.agentId;
    agentToken = identityResult.agentToken;
    console.info(`[Auth] Identity provisioned successfully. ID: ${agentId}`);
  } else {
    console.error('[Auth] registration handshake failed:', identityResult.error);
    process.exit(1);
  }

  /**
   * Primary Telemetry Collection and Reporting Loop.
   */
  setInterval(async () => {
    try {
      console.debug(`[Telemetry] Gathering cluster metrics...`);
      const resources = await getClusterCapacity();
      const fleets = await getAgonesFleetSummary(NAMESPACES);
      const servers = await getAgonesGameServerSummary(NAMESPACES);
      
      const telemetryReport: ClusterReport = {
        resources: {
          cpu: { 
            capacity: resources.cpuTotal.toString(), 
            usage: resources.cpuUsed.toString() 
          },
          memory: { 
            capacity: `${resources.ramTotal.toFixed(2)}Gi`, 
            usage: `${resources.ramUsed.toFixed(2)}Gi` 
          }
        },
        fleets,
        servers
      };

      console.info(`[Telemetry] Preparing report for Hub...`);
      const ingestionResult = await pushReportToHub(HUB_URL, agentId!, agentToken!, telemetryReport);
      console.info(`[Telemetry] Hub interaction completed. Success: ${ingestionResult.success}`);

      if (ingestionResult.success) {
        if (ingestionResult.commands && ingestionResult.commands.length > 0) {
          console.info(`[Commands] RECEIVED ${ingestionResult.commands.length} instructions from Hub at ${new Date().toISOString()}`);
          for (const cmd of ingestionResult.commands) {
            if (cmd.type === 'DEPLOY_FORMATION') {
              console.info(`[Commands] EXECUTING tactical deployment: ${cmd.payload.name}`);
              const result = await applyAgonesConfiguration(cmd.payload.yaml);
              if (result.success) {
                console.info(`[Commands] SUCCESS: Deployment enqueued to cluster for ${cmd.payload.name}`);
              } else {
                console.error(`[Commands] FAILURE: Deployment failed: ${result.error}`);
              }
            }
          }
        }
      } else {
        console.error(`[Telemetry] ingestion failed: ${ingestionResult.error}`);
        
        // Handle identity revocation, expiration, or database wipe
        if (ingestionResult.isUnauthorized || ingestionResult.error?.includes('found')) {
          console.warn(`[Telemetry] Agent ID not recognized (Error: ${ingestionResult.error}). Re-initializing handshake...`);
          const retryIdentity = await registerWithHub(HUB_URL, SHARED_SECRET, agentId);
          if (retryIdentity.success) {
            agentId = retryIdentity.agentId;
            agentToken = retryIdentity.agentToken;
          }
        }
      }
    } catch (error) {
      console.error('[Telemetry] Critical error in reporting loop:', error instanceof Error ? error.message : error);
    }
  }, REPORT_INTERVAL);

  console.info(`[Lifecycle] Telemetry loop active (Interval: ${REPORT_INTERVAL / 1000}s)`);

  /**
   * Log Streaming Server (Port 3001)
   */
  const server = http.createServer(async (req, res) => {
    const { pathname, query } = parse(req.url || '', true);
    
    if (pathname?.startsWith('/logs/')) {
      const gsName = pathname.split('/')[2];
      const namespace = query.ns as string || 'chariot-hoplites';
      
      console.info(`[Logs] Incoming stream request for GameServer: ${gsName} in ${namespace}`);
      
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      await streamGameServerLogs(gsName, namespace, res);
    } else if (pathname === '/health') {
        res.writeHead(200);
        res.end('OK');
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, request) => {
    const { pathname, query } = parse(request.url || '', true);
    console.info(`[Socket] Incoming connection: ${pathname}`);

    if (pathname === '/terminal') {
      const pod = query.pod as string;
      const ns = query.ns as string || 'chariot-hoplites';
      const container = query.container as string || 'server';

      if (!pod) {
        console.error('[Socket] Connection failed: Missing pod parameter');
        ws.send('Error: pod parameter is required');
        ws.close();
        return;
      }

      console.info(`[Socket] Routing terminal session for ${pod} in ${ns}`);
      handleTerminalSession(ws, pod, ns, container);
    } else {
      console.warn(`[Socket] Rejected connection for path: ${pathname}`);
      ws.close();
    }
  });

  server.listen(LOG_SERVER_PORT, () => {
    console.info(`[Logs/Terminal] Server active on port ${LOG_SERVER_PORT}`);
  });
}

startAgent().catch(error => {
  console.error('[Fatal] Final agent failure:', error);
  process.exit(1);
});
