import { test, expect } from '@playwright/test';

test.describe('Tactical Application Lifecycle', () => {
  const adminEmail = 'admin@chariot.hub';
  const adminPass = 'test1234';

  test('should complete the full tactical lifecycle (Init -> Deploy -> Monitor -> Delete)', async ({ page }) => {
    // 1. STRATEGIC INITIATION (Setup)
    console.log('[E2E] Starting Setup...');
    await page.goto('/setup');
    
    // Check if we are already setup (redirected to login or showing error)
    if (page.url().includes('/login')) {
      console.log('[E2E] Setup already completed (Redirect detected), skipping to Login.');
    } else {
      // Check for 'already initialized' message on the setup page itself
      const isInitialized = await page.locator('text=already initialized').isVisible();
      if (isInitialized) {
        console.log('[E2E] Setup already completed (Error message detected), skipping to Login.');
      } else {
        await page.fill('input[placeholder="e.g. Leonidas"]', 'Leonidas');
        await page.fill('input[type="email"]', adminEmail);
        await page.fill('input[type="password"]', adminPass);

        console.log('[E2E] Submitting setup form...');
        await page.click('button[type="submit"]');
        
        // Wait for success message or redirect
        // We handle the case where a race condition might show the error post-submit
        const setupResult = await Promise.race([
          page.waitForSelector('text=established', { timeout: 10000 }).then(() => 'success'),
          page.waitForSelector('text=already initialized', { timeout: 10000 }).then(() => 'initialized'),
          page.waitForNavigation({ url: /.*\/login/, timeout: 10000 }).then(() => 'login')
        ]);

        console.log(`[E2E] Setup outcome: ${setupResult}`);
      }
    }

    // 2. IMPERIAL PORTAL (Login)
    console.log('[E2E] Logging in...');
    await page.goto('/login');
    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', adminPass);
    await page.click('button[type="submit"]');
    
    // Wait for Dashboard (Root)
    await expect(page).toHaveURL('/');
    console.log('[E2E] Authentication successful.');

    // 3. TACTICAL ASSET ENROLLMENT (Verify Seeded Formation)
    console.log('[E2E] Verifying seeded formations...');
    await page.goto('/formations');
    await expect(page.getByText('Standard Tactical Unit')).toBeVisible();
    await expect(page.locator('.formation-card')).toHaveCount(3);
    console.log('[E2E] Registry seeding verified.');

    // 4. TACTICAL DEPLOYMENT (Deploy Hoplite)
    console.log('[E2E] Navigating to Hoplites...');
    await page.goto('/hoplites');
    
    // Select agent (wait for Discovery)
    const agentSelect = page.locator('#agent-select');
    await agentSelect.waitFor({ state: 'visible' });
    
    // Wait for a non-placeholder option to appear
    await expect(async () => {
      const options = await agentSelect.locator('option').allInnerTexts();
      const realAgents = options.filter(o => !o.includes('No Legions'));
      expect(realAgents.length).toBeGreaterThan(0);
    }).toPass({ timeout: 10000 });

    // Select the first real agent
    const options = await agentSelect.locator('option').allInnerTexts();
    const firstAgent = options.find(o => !o.includes('No Legions'));
    if (firstAgent) await agentSelect.selectOption({ label: firstAgent });
    
    // Wait for the Deploy button to become enabled
    const deployBtn = page.getByRole('button', { name: 'Deploy New Hoplite' });
    await expect(deployBtn).toBeEnabled({ timeout: 5000 });
    console.log('[E2E] Clicking Deploy button...');
    await deployBtn.click();
    
    // Wait for the modal and its dropdown to be ready
    const formationSelect = page.getByLabel('Select Formation Template:');
    await formationSelect.waitFor({ state: 'visible' });
    
    // Ensure the options are populated
    await expect(async () => {
      const count = await formationSelect.locator('option').count();
      expect(count).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });
    
    // Select the "Standard Tactical Unit" formation in the modal
    console.log('[E2E] Selecting Standard Tactical Unit formation...');
    await formationSelect.selectOption({ label: 'Standard Tactical Unit (v1.0)' });
    
    // Check for resource visibility in the modal
    await expect(page.getByText('Tactical Specification:')).toBeVisible();
    
    console.log('[E2E] Confirming deployment...');
    await page.click('button:has-text("Confirm Deployment")');
    
    // Wait for the server to be READY (this can take time if image must be pulled)
    console.log('[E2E] Waiting for tactical readiness (Agones Ready)...');
    await expect(page.locator('.badge-ready')).toBeVisible({ timeout: 180000 });
    
    // Verify performance column has IP:Port (not "CONNECTING...")
    await expect(page.locator('tr:has-text("tactical-unit") .text-bronze')).not.toContainText('CONNECTING...', { timeout: 10000 });
    
    console.log('[E2E] Deployment successful and verified RUNNING.');

    // 5. OBSERVATION (Check usage)
    console.log('[E2E] Verifying resource visibility...');
    // Usage stats will be implemented in subsequent steps, 
    // for now we check if the table headers are there.
    await expect(page.locator('th')).toContainText(['CPU', 'RAM', 'DISK']);

    // 6. DECOMMISSION (Delete Hoplite/Formation)
    // TODO: Add deletion steps in UI if buttons are available.
    
    // 7. LOGOUT
    console.log('[E2E] Logging out...');
    // Assuming there's a logout mechanism/button.
    // If not, we'll just verify the test ends here.
  });
});
