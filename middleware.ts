import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware — auth session refresh disabled while phone OTP is not yet configured.
 * TODO: restore Supabase session refresh once auth is wired up.
 */
export async function middleware(request: NextRequest) {
  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
