'use client';
import { useEffect, useState } from 'react';
import {
  CalendarClock, ShoppingBag, AlertTriangle, TrendingUp,
  Users, Building2, Zap, Clock, Video,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { cn, formatCurrency } from '@/lib/utils';
import { reportApi } from '@/lib/api';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';

type Dashboard = Awaited<ReturnType<typeof reportApi.dashboard>>;

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportApi.dashboard()
      .then(setData)
      .catch((e) => console.error('dashboard load failed', e))
      .finally(() => setLoading(false));
  }, []);

  const s = data?.stats;
  const STATS = [
    { label: 'Active Patients', value: String(s?.activePatients ?? 0), icon: Users, color: 'text-primary', bg: 'bg-primary-soft' },
    { label: 'Appointments Today', value: String(s?.appointmentsToday ?? 0), icon: CalendarClock, color: 'text-info', bg: 'bg-info-soft' },
    { label: 'Pending Orders', value: String(s?.pendingOrders ?? 0), icon: ShoppingBag, color: 'text-warning', bg: 'bg-warning-soft' },
    { label: 'Revenue Today', value: formatCurrency(s?.revenueToday ?? 0), icon: TrendingUp, color: 'text-success', bg: 'bg-success-soft' },
    { label: 'Open Disputes', value: String(s?.openDisputes ?? 0), icon: AlertTriangle, color: 'text-danger', bg: 'bg-danger-soft' },
    { label: 'Active Orgs', value: String(s?.activeOrgs ?? 0), icon: Building2, color: 'text-primary', bg: 'bg-primary-soft' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-800 text-text">Command Centre</h1>
          <p className="text-sm text-text-secondary mt-0.5">Real-time platform overview across all organisations</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-text-muted">
          <Clock className="w-3 h-3" />
          {loading ? 'Loading…' : 'Last updated: just now'}
        </span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 stagger-children">
        {STATS.map((stat) => (
          <Card key={stat.label} padding="sm" className="hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-default">
            <div className="flex items-center justify-between mb-3">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', stat.bg)}>
                <stat.icon className={cn('w-4 h-4', stat.color)} />
              </div>
            </div>
            <p className="text-lg font-800 text-text">{loading ? '—' : stat.value}</p>
            <p className="text-[11px] text-text-secondary font-600 mt-0.5">{stat.label}</p>
          </Card>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Revenue chart — 2 cols */}
        <Card className="lg:col-span-2" padding="md">
          <CardHeader>
            <CardTitle>Revenue (7 days)</CardTitle>
            <span className="text-xs text-text-muted">All organisations</span>
          </CardHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.series ?? []}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#821c03" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#821c03" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#821c03" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Organisation health */}
        <Card padding="md">
          <CardHeader>
            <CardTitle>Organisation Health</CardTitle>
            <span className="text-[10px] text-text-muted font-600">{data?.orgs.length ?? 0} total</span>
          </CardHeader>
          <div className="space-y-2.5 max-h-72 overflow-y-auto">
            {(data?.orgs ?? []).length === 0 && !loading && (
              <p className="text-xs text-text-muted py-4 text-center">No organisations yet.</p>
            )}
            {(data?.orgs ?? []).map((org) => (
              <div key={org.id} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2.5">
                  <Avatar name={org.name} size="sm" />
                  <div>
                    <p className="text-xs font-700 text-text">{org.name}</p>
                    <p className="text-[10px] text-text-muted">{org.city} · {org.providerCount} providers</p>
                  </div>
                </div>
                <Badge
                  variant={org.status === 'active' ? 'success' : org.status === 'trial' ? 'warning' : org.status === 'suspended' ? 'danger' : 'muted'}
                  dot
                >
                  {org.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Appointments & Orders chart */}
        <Card className="lg:col-span-2" padding="md">
          <CardHeader>
            <CardTitle>Appointments vs Orders (7 days)</CardTitle>
          </CardHeader>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.series ?? []} barGap={4}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="appointments" fill="#821c03" radius={[4, 4, 0, 0]} barSize={14} name="Appointments" />
                <Bar dataKey="orders" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={14} name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Kill switches */}
        <Card className="lg:col-span-1" padding="md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-warning" />
              <CardTitle>Kill Switches</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {(data?.killSwitches ?? []).map((sw) => (
              <div key={sw.name} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-surface-2 transition-colors">
                <span className="text-xs font-600 text-text">{sw.name}</span>
                <div className="flex items-center gap-2">
                  <span className={cn('w-2 h-2 rounded-full', sw.enabled ? 'bg-success' : 'bg-danger')} />
                  <span className={cn('text-[10px] font-700', sw.enabled ? 'text-success' : 'text-danger')}>
                    {sw.enabled ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Today's live queue */}
      <Card padding="md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <CardTitle>Today&apos;s Appointments Queue</CardTitle>
          </div>
          <span className="text-xs text-text-muted">{data?.appointments.length ?? 0} total</span>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-text-muted font-600 border-b border-border">
                <th className="pb-2.5 pl-2">Patient</th>
                <th className="pb-2.5">Provider</th>
                <th className="pb-2.5">Organisation</th>
                <th className="pb-2.5">Type</th>
                <th className="pb-2.5">Time</th>
                <th className="pb-2.5">Fee</th>
                <th className="pb-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data?.appointments ?? []).length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-text-muted">No appointments scheduled today.</td></tr>
              )}
              {(data?.appointments ?? []).map((apt) => (
                <tr key={apt.id} className="hover:bg-surface-2 transition-colors">
                  <td className="py-2.5 pl-2">
                    <div className="flex items-center gap-2">
                      <Avatar name={apt.patientName} size="sm" />
                      <span className="font-700 text-text">{apt.patientName}</span>
                    </div>
                  </td>
                  <td className="py-2.5 font-600 text-text">{apt.providerName}</td>
                  <td className="py-2.5 text-text-secondary">{apt.orgName}</td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-1">
                      {apt.type === 'video' && <Video className="w-3 h-3 text-info" />}
                      <span className="text-text-secondary capitalize">{apt.type}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-text-secondary">
                    {new Date(apt.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2.5 font-700 text-text">{formatCurrency(apt.fee)}</td>
                  <td className="py-2.5">
                    <Badge
                      variant={apt.status === 'completed' ? 'success' : apt.status === 'in_progress' ? 'info' : apt.status === 'cancelled' ? 'danger' : 'warning'}
                      dot
                    >
                      {apt.status.replace('_', ' ')}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
