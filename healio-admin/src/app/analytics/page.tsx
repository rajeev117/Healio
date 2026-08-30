'use client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn, formatCurrency } from '@/lib/utils';
import { reportApi } from '@/lib/api';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Users, Building2, CalendarClock, ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';

type Analytics = Awaited<ReturnType<typeof reportApi.analytics>>;
const PIE_COLORS = ['#821c03', '#2563eb', '#d97706', '#16a34a', '#8b5cf6'];

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportApi.analytics()
      .then(setData)
      .catch((e) => console.error('analytics load failed', e))
      .finally(() => setLoading(false));
  }, []);

  const t = data?.totals;
  const topMetrics = [
    { label: 'Gross Revenue', value: formatCurrency(t?.grossRevenue ?? 0), icon: TrendingUp, color: 'text-success', bg: 'bg-success-soft' },
    { label: 'Total Patients', value: String(t?.patients ?? 0), icon: Users, color: 'text-info', bg: 'bg-info-soft' },
    { label: 'Total Appointments', value: String(t?.appointments ?? 0), icon: CalendarClock, color: 'text-primary', bg: 'bg-primary-soft' },
    { label: 'Total Orders', value: String(t?.orders ?? 0), icon: ShoppingBag, color: 'text-warning', bg: 'bg-warning-soft' },
    { label: 'Organisations', value: String(t?.organisations ?? 0), icon: Building2, color: 'text-primary', bg: 'bg-primary-soft' },
    { label: 'Completed Visits', value: String(t?.completedAppointments ?? 0), icon: CalendarClock, color: 'text-success', bg: 'bg-success-soft' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-800 text-text">Analytics</h1>
          <p className="text-sm text-text-secondary mt-0.5">Platform-wide performance metrics{loading ? ' · loading…' : ''}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 stagger-children">
        {topMetrics.map(m => (
          <Card key={m.label} padding="sm" className="hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-default">
            <div className="flex items-center gap-3">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', m.bg)}>
                <m.icon className={cn('w-4 h-4', m.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-base font-800 text-text truncate">{loading ? '—' : m.value}</p>
                <p className="text-[10px] text-text-secondary font-600">{m.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card padding="md">
          <CardHeader><CardTitle>New Patient Registrations (14 days)</CardTitle></CardHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.registrations ?? []}>
                <defs>
                  <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} fill="url(#regGrad)" name="New patients" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card padding="md">
          <CardHeader><CardTitle>Providers by Role</CardTitle></CardHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.providersByRole ?? []} barGap={4}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="value" fill="#821c03" radius={[4, 4, 0, 0]} barSize={28} name="Providers" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card padding="md">
          <CardHeader><CardTitle>Appointment Types</CardTitle></CardHeader>
          <div className="h-64 flex items-center">
            {(data?.appointmentsByType ?? []).length === 0 ? (
              <p className="w-full text-center text-xs text-text-muted">No appointment data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data?.appointmentsByType ?? []} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {(data?.appointmentsByType ?? []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card padding="md">
          <CardHeader><CardTitle>Platform Totals</CardTitle></CardHeader>
          <div className="space-y-2.5 py-2">
            {[
              ['Patients', t?.patients ?? 0],
              ['Providers', t?.providers ?? 0],
              ['Organisations', t?.organisations ?? 0],
              ['Appointments', t?.appointments ?? 0],
              ['Completed appointments', t?.completedAppointments ?? 0],
              ['Orders', t?.orders ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                <span className="text-xs text-text-secondary font-600">{label}</span>
                <span className="text-sm font-800 text-text">{loading ? '—' : String(value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
