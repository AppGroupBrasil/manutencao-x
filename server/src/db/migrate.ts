import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function aplicarSchemaBaseline(client: any): Promise<void> {
  const schemaPath = path.join(__dirname, 'schema.sql');
  let sql: string;
  try {
    sql = await fs.readFile(schemaPath, 'utf-8');
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      console.log('[MIGRATE] schema.sql nao encontrado, pulando baseline.');
      return;
    }
    throw err;
  }
  const marker = await client.query("SELECT 1 FROM schema_migrations WHERE filename = '__baseline__'");
  if (marker.rows.length > 0) return;

  console.log('[MIGRATE] Aplicando schema.sql como baseline (tolerante a objetos existentes)...');
  const sqlIdempotente = sql
    .replace(/CREATE TABLE\s+(?!IF NOT EXISTS)/gi, 'CREATE TABLE IF NOT EXISTS ')
    .replace(/CREATE TYPE\s+/gi, 'CREATE TYPE IF NOT EXISTS ')
    .replace(/CREATE INDEX\s+(?!IF NOT EXISTS)/gi, 'CREATE INDEX IF NOT EXISTS ')
    .replace(/CREATE UNIQUE INDEX\s+(?!IF NOT EXISTS)/gi, 'CREATE UNIQUE INDEX IF NOT EXISTS ');

  const statements = sqlIdempotente.split(/;\s*$/m).map(s => s.trim()).filter(Boolean);
  let okCount = 0;
  let skipCount = 0;
  for (const stmt of statements) {
    try {
      await client.query(stmt);
      okCount++;
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('already exists') || msg.includes('ja existe') || msg.includes('duplicate')) {
        skipCount++;
      } else {
        console.warn(`[MIGRATE] baseline stmt ignorado: ${msg.slice(0, 100)}`);
        skipCount++;
      }
    }
  }
  await client.query("INSERT INTO schema_migrations (filename) VALUES ('__baseline__') ON CONFLICT DO NOTHING");
  console.log(`[MIGRATE] baseline: ok=${okCount} skipped=${skipCount}`);
}

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        aplicado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await aplicarSchemaBaseline(client);

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
