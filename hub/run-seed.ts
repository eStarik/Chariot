import { seedDatabase } from './src/lib/db/seed';

async function run() {
  await seedDatabase();
  console.log('Seed completed');
  process.exit(0);
}

run().catch(console.error);
