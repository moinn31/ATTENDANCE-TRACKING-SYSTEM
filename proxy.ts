import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-for-development'
);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Define public and auth-only routes
  const isAuthRoute = pathname.startsWith('/auth');
  const isPublicRoute = 
    pathname.startsWith('/api/auth') || 
    pathname.startsWith('/_next') || 
    pathname.includes('/icon.svg') ||
    pathname.includes('/favicon.ico');

  // 2. Get token from cookies
  const token = request.cookies.get('auth_token')?.value;

  // 3. Verify token
  let isValidToken = false;
  if (token) {
    try {
      await jwtVerify(token, secret);
      isValidToken = true;
    } catch (err) {
      isValidToken = false;
    }
  }

  // 4. Logic:
  // If trying to access protected route without valid token -> redirect to login
  if (!isValidToken && !isAuthRoute && !isPublicRoute && pathname !== '/auth/login') {
    const loginUrl = new URL('/auth/login', request.url);
    // loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If already logged in and trying to access login/auth pages -> redirect to dashboard
  if (isValidToken && isAuthRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};

export default proxy;
