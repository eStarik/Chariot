import 'dotenv/config';
import { registerWithHub, loadConfig } from './logic';
import { getClusterCapacity, getAgonesFleetSummary } from './monitor';
import { pushReportToHub } from './reporter';

const HUB_URL = process.env.HUB_URL || 'http://localhost:3000';
const SHARED_SECRET = process.env.SHARED_SECRET;
const REPORT_INTERVAL = parseInt(process.env.REPORT_INTERVAL || '30000'); // Default 30s
const NAMESPACES = (process.env.NAMESPACES || 'default').split(',');

async function startAgent() {
  if (!SHARED_SECRET) {
    console.error('CRITICAL: SHARED_SECRET environment variable is not set.');
    process.exit(1);
  }

  console.log('--- Chariot Agent Starting ---');

  // 1. Initial Registration / Re-connection
  const config = await loadConfig();
  let agentId = config?.agent_id;
  let agentToken = config?.agent_token;

  console.log(`Checking registration status: ${agentId ? 'Existing' : 'New'}`);

  const registration = await registerWithHub(HUB_URL, SHARED_SECRET, agentId);

  if (registration.success) {
    agentId = registration.agentId;
    agentToken = registration.agentToken;
    console.log(`Agent registered successfully. ID: ${agentId}`);
  } else {
    console.error('Failed to register with Hub:', registration.error);
    process.exit(1);
  }

  // 2. Main Reporting Loop
  setInterval(async () => {
    try {
      console.log(`[${new Date().toISOString()}] Gathering metrics...`);
      
      const resources = await getClusterCapacity();
      const fleets = await getAgonesFleetSummary(NAMESPACES);

      const reportData = {
        timestamp: new Date().toISOString(),
        resources,
        fleets,
        metadata: {
          cluster_name: process.env.CLUSTER_NAME || 'unknown-cluster'
        }
      };

      const pushResult = await pushReportToHub(HUB_URL, agentId!, agentToken!, reportData);

      if (pushResult.success) {
        console.log(`[${new Date().toISOString()}] Report successfully pushed.`);
      } else {
        console.error(`[${new Date().toISOString()}] Push failed:`, pushResult.error);
        if (pushResult.error === 'Invalid agent token' || pushResult.error === 'Agent not found') {
          console.warn('Authentication lost. Re-triggering registration...');
          // Logic for re-registration could go here
        }
      }
    } catch (err) {
      console.error('Error in reporting loop:', err);
    }
  }, REPORT_INTERVAL);

  console.log(`Reporting loop active. Interval: ${REPORT_INTERVAL / 1000}s`);
}

startAgent().catch(err => {
  console.error('Fatal agent error:', err);
  process.exit(1);
});
