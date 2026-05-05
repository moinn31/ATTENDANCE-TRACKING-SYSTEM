import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-for-development'
);

export async function signToken(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);
}

export async function verifyJWT(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (err) {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;
  return await verifyJWT(token);
}

/**
 * Legacy support for existing API routes that use req.headers.get('authorization')
 */
export async function verifyTokenFromRequest(req: NextRequest | Request) {
  try {
    let token = '';
    
    // Check Authorization header first (legacy/mobile)
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } 
    // Check cookies (modern/web)
    else {
      const cookieStore = req.headers.get('cookie');
      if (cookieStore) {
        const match = cookieStore.match(/auth_token=([^;]+)/);
        if (match) token = match[1];
      }
    }

    if (!token) return null;

    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (err) {
    return null;
  }
}

// For backward compatibility with existing code that calls verifyToken(request)
export async function verifyToken(req: any) {
  const payload = await verifyTokenFromRequest(req);
  if (!payload) {
    throw new Error('Unauthorized');
  }
  return payload;
}
