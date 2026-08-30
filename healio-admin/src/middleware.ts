import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// Auth is handled client-side in AdminShell (Supabase stores the session in the
// browser, which Edge middleware can't read without the @supabase/ssr cookie
// adapter). AdminShell checks the session and redirects guests to /login.
// This middleware is intentionally a pass-through.
// ─────────────────────────────────────────────────────────────────────────────
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
