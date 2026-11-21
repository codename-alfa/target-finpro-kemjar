const { pool, initDatabase, resetAndSeedDatabase } = require('../db');

async function main() {
  try {
    await initDatabase();
    const summary = await resetAndSeedDatabase();
    console.log(
      `[SEED] PostgreSQL finvault_b20 ready: ${summary.seededUsers} users, ${summary.seededTransactions} transactions seeded.`
    );
    process.exitCode = 0;
  } catch (err) {
    console.error('[SEED] Failed to initialize/seed database:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
