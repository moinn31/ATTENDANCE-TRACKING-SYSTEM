import { Pool } from "pg";

let pool = null;

function getPool() {
  if (pool) return pool;

  const password = process.env.POSTGRES_PASSWORD;
  const host = process.env.POSTGRES_HOST || "student-db.c49geqe6ga6f.us-east-1.rds.amazonaws.com";
  const user = process.env.POSTGRES_USER || "postgres";
  const database = process.env.POSTGRES_DB || "student_db";
  const port = parseInt(process.env.POSTGRES_PORT || "5432", 10);
  const ssl = process.env.POSTGRES_SSL === "false" ? false : { rejectUnauthorized: false };

  if (!password) {
    console.error("CRITICAL: POSTGRES_PASSWORD is not set in .env.local");
  }

  pool = new Pool({
    host,
    port,
    user,
    password,
    database,
    ssl,
    connectionTimeoutMillis: 10000, 
    idleTimeoutMillis: 30000,
    max: 10
  });

  return pool;
}

export default new Proxy({}, {
  get(target, prop) {
    const p = getPool();
    const val = p[prop];
    return typeof val === 'function' ? val.bind(p) : val;
  },
});
