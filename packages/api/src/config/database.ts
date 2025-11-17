import { Pool, PoolConfig } from 'pg';
import { DatabaseError } from '@news-curator/shared';

let pool: Pool | null = null;

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export function createDatabasePool(config: DatabaseConfig): Pool {
  const poolConfig: PoolConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: config.max || 20,
    idleTimeoutMillis: config.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
  };

  pool = new Pool(poolConfig);

  pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
  });

  return pool;
}

export function getDatabasePool(): Pool {
  if (!pool) {
    throw new DatabaseError('Database pool not initialized');
  }
  return pool;
}

export async function closeDatabasePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const client = await getDatabasePool().connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } catch (error) {
    throw new DatabaseError(
      `Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { query: text, params, originalError: error }
    );
  } finally {
    client.release();
  }
}

export async function queryOne<T = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}
