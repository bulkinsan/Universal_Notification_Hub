const { initDb } = require('./db');
const { runMigrations } = require('./services/migrator');

async function migrate() {
  await initDb();
  await runMigrations();
  console.log('All migrations applied.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
