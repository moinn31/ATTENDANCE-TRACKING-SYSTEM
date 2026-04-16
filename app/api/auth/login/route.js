import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "@/lib/db.js";

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return Response.json({ error: "Email and password are required" }, { status: 400 });
    }

    if (!process.env.JWT_SECRET) {
      return Response.json({ error: "JWT_SECRET is not configured" }, { status: 500 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const result = await pool.query("SELECT id, email, password FROM users WHERE email = $1", [normalizedEmail]);
    const user = result.rows[0];

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 401 });
    }

    const valid = await bcrypt.compare(String(password), user.password);

    if (!valid) {
      return Response.json({ error: "Invalid password" }, { status: 401 });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    return Response.json({ token });
  } catch {
    return Response.json({ error: "Login failed" }, { status: 500 });
  }
}