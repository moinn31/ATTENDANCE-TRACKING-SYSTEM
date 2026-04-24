import { Pool } from "pg";

let pool = null;

function getPool() {
  if (pool) return pool;

  if (!process.env.POSTGRES_PASSWORD) {
    throw new Error("POSTGRES_PASSWORD is required. Set it in your environment or .env.local.");
  }

  pool = new Pool({
    host: "student-db.c49geqe6ga6f.us-east-1.rds.amazonaws.com",
    port: 5432,
    user: "postgres",
    password: process.env.POSTGRES_PASSWORD,
    database: "student_db",
    ssl: {
      rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 10000, // 10 seconds
    idleTimeoutMillis: 30000,       // 30 seconds
    max: 10                         // limit pool size for stability
  });

  return pool;
}

// Export a lazy-loaded pool proxy
export default new Proxy({}, {
  get(target, prop) {
    return getPool()[prop];
  },
});
