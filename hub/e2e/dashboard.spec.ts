import { test, expect } from '@playwright/test';

test.describe('Chariot Dashboard UI', () => {
  test('should show waiting for discovery state initially', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Chariot');
    await expect(page.getByText('Waiting for Agent Discovery...')).toBeVisible();
  });

  test('should update UI when a cluster report arrives via SSE', async ({ page }) => {
    await page.goto('/');
    
    // Simulating an SSE event injection for UI test (mocking the event source)
    // In a real E2E, we would trigger a POST to /api/v1/report
    const agentId = 'test-agent-123';
    const clusterName = 'E2E-Cluster';

    // Mock API call to trigger a report
    // Note: This requires the Hub to be running
    const response = await page.request.post('/api/v1/register', {
      data: {
        secret: 'chariot-production-secret-2024', // Use a test secret
        metadata: { cluster_name: clusterName }
      }
    });
    
    const regData = await response.json();
    const token = regData.agent_token;
    const id = regData.agent_id;

    await page.request.post('/api/v1/report', {
      headers: {
        'X-Agent-ID': id,
        'X-Agent-Token': token
      },
      data: {
        resources: { cpuTotal: 10, cpuUsed: 2, ramTotal: 64, ramUsed: 8 },
        fleets: [{ fleetName: 'e2e-fleet', ready: 5, allocated: 1 }],
        metadata: { cluster_name: clusterName }
      }
    });

    // Verify the UI updated
    await expect(page.getByText(clusterName)).toBeVisible();
    await expect(page.getByText('10 / 10 CORES')).not.toBeVisible(); // Just a sanity check
    await expect(page.getByText('2 / 10 CORES')).toBeVisible();
  });
});
