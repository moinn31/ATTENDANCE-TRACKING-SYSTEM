import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const rawPassword = String(password);

    if (rawPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    await pool.query('INSERT INTO users (email, password) VALUES ($1, $2)', [normalizedEmail, hashedPassword]);

    return NextResponse.json({ message: 'User created' }, { status: 201 });
  } catch (error: any) {
    if (error && typeof error === 'object' && error.code === '23505') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }

    console.error('[AUTH_REGISTER_ERROR]', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
