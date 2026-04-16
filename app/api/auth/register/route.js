import bcrypt from "bcrypt";
import pool from "@/lib/db.js";

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return Response.json({ error: "Email and password are required" }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const rawPassword = String(password);

    if (rawPassword.length < 6) {
      return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    await pool.query("INSERT INTO users (email, password) VALUES ($1, $2)", [normalizedEmail, hashedPassword]);

    return Response.json({ message: "User created" }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "23505") {
      return Response.json({ error: "Email already exists" }, { status: 409 });
    }

    return Response.json({ error: "Failed to create user" }, { status: 500 });
  }
}