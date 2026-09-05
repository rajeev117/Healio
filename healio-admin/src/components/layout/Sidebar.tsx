'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { navApi } from '@/lib/api';
import {
  LayoutDashboard, Building2, Users, UserCog, ToggleLeft,
  Zap, CalendarClock, ShoppingBag, AlertTriangle, Activity,
  CreditCard, Wallet, RotateCcw, TrendingUp,
  DollarSign, Bell, Megaphone, ScrollText, Settings,
  ChevronDown, Shield, LogOut, BarChart2, FlaskConical, Stethoscope, BadgeCheck,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/analytics', icon: BarChart2, label: 'Analytics' },
    ],
  },
  {
    label: 'Tenants',
    items: [
      { href: '/organisations', icon: Building2, label: 'Organisations' },
      { href: '/onboarding-queue', icon: Zap, label: 'Onboarding Queue' },
    ],
  },
  {
    label: 'Users',
    items: [
      { href: '/users/patients', icon: Users, label: 'Patients' },
      { href: '/users/providers', icon: UserCog, label: 'Organisation Staff' },
      { href: '/users/individual-providers', icon: BadgeCheck, label: 'Independent Providers' },
      { href: '/users/rmps', icon: Stethoscope, label: 'Healthcare Consultants' },
      { href: '/users/sub-admins', icon: Shield, label: 'Sub-Admins' },
    ],
  },
  {
    label: 'Feature Control',
    items: [
      { href: '/features', icon: ToggleLeft, label: 'Features' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/operations/appointments', icon: CalendarClock, label: 'Appointments' },
      { href: '/operations/orders', icon: ShoppingBag, label: 'Orders' },
      { href: '/operations/disputes', icon: AlertTriangle, label: 'Disputes', danger: true },
      { href: '/operations/sla-monitor', icon: Activity, label: 'SLA Monitor' },
    ],
  },
  {
    label: 'Financial',
    items: [
      { href: '/financial/transactions', icon: CreditCard, label: 'Transactions' },
      { href: '/financial/wallets', icon: Wallet, label: 'Wallets' },
      { href: '/financial/refunds', icon: RotateCcw, label: 'Refunds' },
      { href: '/financial/revenue', icon: TrendingUp, label: 'Revenue' },
    ],
  },
  {
    label: 'Config & Content',
    items: [
      { href: '/config/pricing', icon: DollarSign, label: 'Pricing Rules' },
      { href: '/config/banners', icon: Megaphone, label: 'Banners' },
      { href: '/config/notifications', icon: Bell, label: 'Push Notifications' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/audit-logs', icon: ScrollText, label: 'Audit Logs' },
      { href: '/settings', icon: Settings, label: 'Settings' },
      { href: '/dev-tools', icon: FlaskConical, label: 'Dev Tools' },
    ],
  },
];

interface SidebarProps { collapsed: boolean; }

export function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname();
  const router  = useRouter();
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Badge counts, refreshed on a timer rather than on every navigation.
  //
  // This used to depend on `pathname`, so each click fired getSidebarCounts()
  // — five Supabase count queries — on top of whatever the page itself
  // fetched. The badges are ambient information; a minute of staleness costs
  // nothing, and moving between pages should not re-query the database.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      navApi.counts()
        .then((c) => {
          if (cancelled) return;
          setCounts({
            '/onboarding-queue': c.onboarding,
            '/operations/appointments': c.appointmentsToday,
            '/operations/orders': c.orders,
            '/operations/disputes': c.disputes,
            '/financial/refunds': c.refunds,
          });
        })
        .catch((e) => console.error('Failed to load nav counts:', e));
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <aside className={cn(
      'flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 shrink-0',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 px-4 h-14 border-b border-sidebar-border shrink-0',
        collapsed && 'justify-center px-0'
      )}>
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <span className="text-white font-800 text-xs">H</span>
        </div>
        {!collapsed && (
          <div>
            <p className="text-sidebar-text-active font-800 text-sm leading-none">Healio</p>
            <p className="text-sidebar-text text-[10px] mt-0.5">Admin Portal</p>
          </div>
        )}
      </div>

      {/* Org switcher */}
      {!collapsed && (
        <div className="px-3 py-2 border-b border-sidebar-border shrink-0">
          <button className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-sidebar-active hover:bg-sidebar-hover transition-colors text-left">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-primary-soft flex items-center justify-center shrink-0">
                <span className="text-primary text-[9px] font-800">ALL</span>
              </span>
              <span className="text-sidebar-text-active text-xs font-700">All Organisations</span>
            </div>
            <ChevronDown className="w-3 h-3 text-sidebar-text" />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll py-2">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-1">
            {!collapsed && (
              <p className="text-[10px] font-700 text-sidebar-text uppercase tracking-widest px-4 py-1.5">
                {section.label}
              </p>
            )}
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link key={item.href} href={item.href}>
                  <div className={cn(
                    'flex items-center gap-3 px-3 mx-1.5 rounded-md transition-colors group',
                    collapsed ? 'justify-center py-2.5' : 'py-1.5',
                    active
                      ? 'bg-sidebar-active text-sidebar-text-active'
                      : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active'
                  )}>
                    <item.icon className={cn('shrink-0', collapsed ? 'w-5 h-5' : 'w-4 h-4')} />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-xs font-600">{item.label}</span>
                        {counts[item.href] > 0 && (
                          <span className={cn(
                            'text-[10px] font-800 px-1.5 py-0.5 rounded-full',
                            'danger' in item && item.danger
                              ? 'bg-danger text-white'
                              : 'bg-sidebar-active text-sidebar-text-active'
                          )}>
                            {counts[item.href]}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={cn(
        'border-t border-sidebar-border shrink-0 p-3',
        collapsed ? 'flex justify-center' : ''
      )}>
        {collapsed ? (
          <button onClick={handleLogout} className="p-2 rounded-md text-sidebar-text hover:text-sidebar-text-active hover:bg-sidebar-hover" title="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="text-white text-[10px] font-800">SA</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sidebar-text-active text-xs font-700 truncate">Super Admin</p>
              <p className="text-sidebar-text text-[10px] truncate">admin@healio.in</p>
            </div>
            <button onClick={handleLogout} className="text-sidebar-text hover:text-sidebar-text-active transition-colors" title="Sign out">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
