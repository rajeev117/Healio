'use client';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { supabase } from '@/lib/supabase';

const PUBLIC_ROUTES = ['/login'];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [authState, setAuthState] = useState<'loading' | 'authed' | 'guest'>('loading');
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setAuthState(data.session ? 'authed' : 'guest');
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setAuthState(session ? 'authed' : 'guest');
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Redirect logic
  useEffect(() => {
    if (authState === 'loading') return;
    if (authState === 'guest' && !isPublic) {
      router.replace('/login');
    }
    if (authState === 'authed' && isPublic) {
      router.replace('/dashboard');
    }
  }, [authState, isPublic, pathname, router]);

  // Public route (login): render bare, no chrome
  if (isPublic) {
    return <>{children}</>;
  }

  // Still resolving session, or about to redirect a guest
  if (authState !== 'authed') {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-2">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center animate-pulse">
            <span className="text-white font-800 text-lg">H</span>
          </div>
          <p className="text-xs text-text-muted">Loading…</p>
        </div>
      </div>
    );
  }

  // Authenticated: full admin chrome
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar onToggleSidebar={() => setCollapsed(!collapsed)} />
        <main key={pathname} className="flex-1 overflow-y-auto p-5 page-enter">{children}</main>
      </div>
    </div>
  );
}
