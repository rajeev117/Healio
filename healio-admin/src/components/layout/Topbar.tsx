'use client';
import { Bell, Menu, Search, ChevronRight } from 'lucide-react';
import { usePathname } from 'next/navigation';

const breadcrumbMap: Record<string, string> = {
  dashboard: 'Dashboard',
  analytics: 'Analytics',
  organisations: 'Organisations',
  'onboarding-queue': 'Onboarding Queue',
  users: 'Users',
  patients: 'Patients',
  providers: 'Organisation Staff',
  'individual-providers': 'Independent Providers',
  rmps: 'Healthcare Consultants',
  'sub-admins': 'Sub-Admins',
  'feature-flags': 'Feature Flags',
  'kill-switches': 'Kill Switches',
  operations: 'Operations',
  appointments: 'Appointments',
  orders: 'Orders',
  disputes: 'Disputes',
  'sla-monitor': 'SLA Monitor',
  financial: 'Financial',
  transactions: 'Transactions',
  wallets: 'Wallets',
  refunds: 'Refunds',
  revenue: 'Revenue',
  config: 'Config',
  services: 'Service Categories',
  pricing: 'Pricing Rules',
  banners: 'Banners',
  notifications: 'Notifications',
  'audit-logs': 'Audit Logs',
  settings: 'Settings',
  'dev-tools': 'Dev Tools',
  features: 'Features',
};

// A route with no entry above used to render its raw slug in the breadcrumb.
const prettifySegment = (seg: string) =>
  seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

interface TopbarProps {
  onToggleSidebar: () => void;
}

export function Topbar({ onToggleSidebar }: TopbarProps) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <header className="h-14 bg-topbar border-b border-topbar-border flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg hover:bg-surface-3 text-text-secondary transition-colors"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 text-sm">
          {segments.map((seg, i) => (
            <span key={seg} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3 text-text-muted" />}
              <span className={i === segments.length - 1 ? 'font-700 text-text' : 'text-text-secondary'}>
                {breadcrumbMap[seg] ?? prettifySegment(seg)}
              </span>
            </span>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="Search anything..."
            className="pl-9 pr-3 py-1.5 w-56 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-150"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-text-muted bg-surface-3 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-surface-3 text-text-secondary transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full" />
        </button>

        {/* Live indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-success-soft rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          <span className="text-[10px] font-700 text-success">LIVE</span>
        </div>
      </div>
    </header>
  );
}
