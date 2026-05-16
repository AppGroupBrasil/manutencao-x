import 'dotenv/config';
import { runMigrations } from './migrate.js';
import { closePool } from './database.js';

runMigrations()
  .then(async () => {
    await closePool();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[MIGRATE CLI] Erro:', err);
    await closePool().catch(() => {});
    process.exit(1);
  });
