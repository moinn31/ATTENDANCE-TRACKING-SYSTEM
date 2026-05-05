import pool from "./lib/db";

async function checkUsers() {
  try {
    const result = await pool.query("SELECT id, email FROM users");
    console.log("Registered Users:");
    console.table(result.rows);
  } catch (err) {
    console.error("Error checking users:", err);
  } finally {
    process.exit();
  }
}

checkUsers();
