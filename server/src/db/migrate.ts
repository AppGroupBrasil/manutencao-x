import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        aplicado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    let files: string[];
    try {
      files = (await fs.readdir(migrationsDir)).filter(f => f.endsWith('.sql')).sort();
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        console.warn('[MIGRATE] Diretório migrations/ não encontrado, pulando.');
        return;
      }
      throw err;
    }

    const { rows } = await client.query<{ filename: string }>('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map(r => r.filename));

    let okCount = 0;
    let skipCount = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf-8');
      console.log(`[MIGRATE] Aplicando ${file}...`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[MIGRATE] ✓ ${file}`);
        okCount++;
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.warn(`[MIGRATE] ⚠ Skipped ${file}: ${err.message}`);
        skipCount++;
      }
    }
    console.log(`[MIGRATE] Concluido. ok=${okCount} skipped=${skipCount}`);
  } finally {
    client.release();
  }
}
