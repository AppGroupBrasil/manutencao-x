import { Pool, PoolClient } from 'pg';

if (!process.env.DB_PASSWORD && process.env.NODE_ENV === 'production') {
  console.error('[DB] ❌ DB_PASSWORD não definido em produção! Encerrando.');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'manutencao',
  user: process.env.DB_USER || 'manutencao',
  password: process.env.DB_PASSWORD || 'manutencao_secret',
  max: 40,
  min: 4,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000,
  allowExitOnIdle: false,
  ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === 'strict'
    ? { rejectUnauthorized: process.env.DB_SSL_STRICT !== 'false' }
    : false,
});

pool.on('error', (err) => {
  console.error('[DB Pool] Erro em conexão idle:', err.message);
});

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  let retries = 3;
  while (retries > 0) {
    try {
      const { rows } = await pool.query(text, params);
      return rows as T[];
    } catch (err: any) {
      if (err.code === 'ECONNRESET' || err.code === '08P01' || err.message.includes('connection')) {
        retries--;
        if (retries === 0) throw err;
        await new Promise(res => setTimeout(res, 500));
      } else {
        throw err;
      }
    }
  }
  return [];
}

export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const { rows } = await pool.query(text, params);
  return (rows[0] as T) ?? null;
}

export async function execute(text: string, params?: any[]): Promise<number> {
  const { rowCount } = await pool.query(text, params);
  return rowCount ?? 0;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function paginate<T = any>(
  baseQuery: string,
  params: any[],
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedResult<T>> {
  const p = Math.max(1, page);
  const ps = Math.min(100, Math.max(1, pageSize));
  const offset = (p - 1) * ps;

  const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) _cnt`;
  const countResult = await pool.query(countQuery, params);
  const total = parseInt(countResult.rows[0]?.total || '0');

  const dataQuery = `${baseQuery} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const { rows } = await pool.query(dataQuery, [...params, ps, offset]);

  return {
    data: rows as T[],
    total,
    page: p,
    pageSize: ps,
    totalPages: Math.ceil(total / ps),
  };
}

export async function closePool(): Promise<void> {
  await pool.end();
}

export default pool;
