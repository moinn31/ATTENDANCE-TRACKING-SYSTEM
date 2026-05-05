import pool from "./lib/db";
import bcrypt from "bcrypt";

async function createAdmin() {
  const email = "admin@example.com";
  const password = "admin";
  
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Check if user exists
    const check = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    
    if (check.rows.length > 0) {
      await pool.query("UPDATE users SET password = $2 WHERE email = $1", [email, hashedPassword]);
      console.log("Admin password updated successfully!");
    } else {
      await pool.query(
        "INSERT INTO users (email, password) VALUES ($1, $2)",
        [email, hashedPassword]
      );
      console.log("Admin user created successfully!");
    }
    
    console.log("Email: " + email);
    console.log("Password: " + password);
    
  } catch (err) {
    console.error("Error creating admin:", err);
  } finally {
    process.exit();
  }
}

createAdmin();
