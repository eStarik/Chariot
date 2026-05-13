import { seedDatabase } from './src/lib/db/seed';

async function main() {
  console.log('--- TACTICAL SEEDING INITIATED ---');
  await seedDatabase();
  console.log('--- TACTICAL SEEDING COMPLETED ---');
  process.exit(0);
}

main();
