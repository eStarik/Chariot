import 'dotenv/config';
import { registerWithHub, loadPersistentConfig } from './logic';
import { getClusterCapacity, getAgonesFleetSummary, getAgonesGameServerSummary, applyAgonesConfiguration } from './monitor';
import { pushReportToHub, ClusterReport } from './reporter';

const HUB_URL = process.env.HUB_URL || 'http://localhost:3000';
const SHARED_SECRET = process.env.SHARED_SECRET;
const REPORT_INTERVAL = parseInt(process.env.REPORT_INTERVAL || '30000'); 
const NAMESPACES = (process.env.NAMESPACES || 'default').split(',');

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
      const fleets = await getAgonesFleetSummary(['default']);
      const servers = await getAgonesGameServerSummary(['default']);
      
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
          console.info(`[Commands] Received ${ingestionResult.commands.length} instructions from Hub:`, JSON.stringify(ingestionResult.commands, null, 2));
          for (const cmd of ingestionResult.commands) {
            if (cmd.type === 'DEPLOY_FORMATION') {
              console.info(`[Commands] Executing deployment: ${cmd.payload.name}`);
              const result = await applyAgonesConfiguration(cmd.payload.yaml);
              if (result.success) {
                console.info(`[Commands] Deployment successful: ${cmd.payload.name}`);
              } else {
                console.error(`[Commands] Deployment failed: ${result.error}`);
              }
            }
          }
        }
      } else {
        console.error(`[Telemetry] ingestion failed: ${ingestionResult.error}`);
        
        // Handle identity revocation or expiration
        if (ingestionResult.isUnauthorized) {
          console.warn('[Telemetry] Identity revoked by Hub. Re-initializing handshake...');
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
}

startAgent().catch(error => {
  console.error('[Fatal] Final agent failure:', error);
  process.exit(1);
});
