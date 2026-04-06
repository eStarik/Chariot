export async function register() {
  if (process.env.NEXT_RUNTIME === 'node') {
    // Skip seeding during the build phase to prevent database connection failures
    if (process.env.NEXT_PHASE === 'phase-production-build') return;
    
    try {
      const { seedDatabase } = await import('./lib/db/index');
      await seedDatabase();
    } catch (e) {
      console.warn('[Instrumentation] Seeding skipped or failed (likely during build/init):', e);
    }
  }
}
