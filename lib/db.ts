import { Pool } from 'pg';

declare global {
  var _pgPool: Pool | undefined;
}

function getPool(): Pool {
  if (globalThis._pgPool) return globalThis._pgPool;

  const password = process.env.POSTGRES_PASSWORD;
  const host = process.env.POSTGRES_HOST || 'student-db.c49geqe6ga6f.us-east-1.rds.amazonaws.com';
  const user = process.env.POSTGRES_USER || 'postgres';
  const database = process.env.POSTGRES_DB || 'student_db';
  const port = parseInt(process.env.POSTGRES_PORT || '5432', 10);
  const ssl = process.env.POSTGRES_SSL === 'false' ? false : { rejectUnauthorized: false };

  if (!password) {
    console.error('CRITICAL: POSTGRES_PASSWORD is not set in .env.local');
  }

  globalThis._pgPool = new Pool({
    host,
    port,
    user,
    password,
    database,
    ssl,
    connectionTimeoutMillis: 15000, // increased timeout
    idleTimeoutMillis: 30000,
    max: 20 // increased max connections
  });

  return globalThis._pgPool;
}

// Export a proxy that mimics the Pool interface
const poolProxy = new Proxy({} as Pool, {
  get(target, prop: keyof Pool) {
    const p = getPool();
    const val = p[prop];
    return typeof val === 'function' ? (val as any).bind(p) : val;
  },
});

export default poolProxy;
