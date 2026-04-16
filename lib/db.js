import { Pool } from "pg";

if (!process.env.POSTGRES_PASSWORD) {
  throw new Error("POSTGRES_PASSWORD is required. Set it in your environment or .env.local.");
}

const pool = new Pool({
  host: "student-db.c49geqe6ga6f.us-east-1.rds.amazonaws.com",
  port: 5432,
  user: "postgres",
  password: process.env.POSTGRES_PASSWORD,
  database: "student_db",
  ssl: {
    rejectUnauthorized: false,
  },
});

export default pool;