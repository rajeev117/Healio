'use client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import { reportApi } from '@/lib/api';
import { TrendingUp, Wallet } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useEffect, useState } from 'react';

type Revenue = Awaited<ReturnType<typeof reportApi.revenue>>;
const streamColors = ['#821c03', '#2563eb', '#d97706', '#16a34a'];

export default function RevenuePage() {
  const [data, setData] = useState<Revenue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportApi.revenue()
      .then(setData)
      .catch((e) => console.error('revenue load failed', e))
      .finally(() => setLoading(false));
  }, []);

  const trend = data?.trend ?? [];
  const totalRevenue = trend.reduce((s, d) => s + d.revenue, 0);
  const avgDaily = trend.length ? Math.round(totalRevenue / trend.length) : 0;
  const breakdown = data?.breakdown ?? [];
  const breakdownTotal = breakdown.reduce((s, b) => s + b.amount, 0) || 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-800 text-text">Revenue</h1>
          <p className="text-sm text-text-secondary mt-0.5">Platform revenue analytics{loading ? ' · loading…' : ''}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-children">
        <Card padding="md" className="bg-primary-soft border-primary/20 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-primary" /><span className="text-xs font-700 text-text-secondary">Total (30d)</span></div>
          <p className="text-2xl font-800 text-primary">{formatCurrency(totalRevenue)}</p>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-2 mb-2"><span className="text-xs font-700 text-text-secondary">Average Daily</span></div>
          <p className="text-2xl font-800 text-text">{formatCurrency(avgDaily)}</p>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-2 mb-2"><Wallet className="w-4 h-4 text-info" /><span className="text-xs font-700 text-text-secondary">Platform Fees</span></div>
          <p className="text-2xl font-800 text-text">{formatCurrency(data?.totals.platformFees ?? 0)}</p>
        </Card>
      </div>

      <Card padding="md">
        <CardHeader><CardTitle>Revenue Trend (30 days)</CardTitle></CardHeader>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="revGrad3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#821c03" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#821c03" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={3} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v) => [formatCurrency(Number(v)), 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke="#821c03" strokeWidth={2} fill="url(#revGrad3)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card padding="md">
        <CardHeader><CardTitle>Revenue by Source</CardTitle></CardHeader>
        <div className="space-y-3">
          {breakdown.map((stream, i) => {
            const percent = Math.round((stream.amount / breakdownTotal) * 100);
            return (
              <div key={stream.source} className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: streamColors[i % streamColors.length] }} />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-700 text-text">{stream.source}</span>
                    <span className="text-sm font-800 text-text">{formatCurrency(stream.amount)}</span>
                  </div>
                  <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: streamColors[i % streamColors.length] }} />
                  </div>
                </div>
                <span className="text-xs font-700 text-text-secondary w-10 text-right">{percent}%</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card padding="md">
        <CardHeader><CardTitle>Recent Transactions</CardTitle></CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-text-muted font-600 border-b border-border">
                <th className="pb-2.5 pl-2">Type</th>
                <th className="pb-2.5">Organisation</th>
                <th className="pb-2.5">Date</th>
                <th className="pb-2.5 text-right pr-2">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data?.recent ?? []).length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-text-muted">No transactions yet.</td></tr>
              )}
              {(data?.recent ?? []).map((tx, i) => (
                <tr key={i} className="hover:bg-surface-2 transition-colors">
                  <td className="py-2.5 pl-2 capitalize font-600 text-text">{tx.type}</td>
                  <td className="py-2.5 text-text-secondary">{tx.orgName}</td>
                  <td className="py-2.5 text-text-secondary">{new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                  <td className="py-2.5 text-right pr-2 font-700 text-text">{formatCurrency(tx.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
