'use client';
import { useState, useEffect } from 'react';
import { Eye } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { cn, formatCurrency } from '@/lib/utils';
import { orderApi } from '@/lib/api';
import type { Order } from '@/types';

const TYPE_TABS = ['All', 'Pharmacy', 'Lab', 'Home Care'] as const;

const statusMap: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'muted' | 'primary'> = {
  pending: 'warning', confirmed: 'info', processing: 'info',
  out_for_delivery: 'primary', completed: 'success', cancelled: 'danger',
};
const typeMap: Record<string, 'primary' | 'info' | 'warning'> = {
  pharmacy: 'primary', lab: 'info', homecare: 'warning',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [fetching, setFetching] = useState(true);
  const [tab, setTab] = useState('All');
  const [viewing, setViewing] = useState<Order | null>(null);

  useEffect(() => {
    orderApi.list()
      .then(setOrders)
      .catch((e) => console.error('Failed to load orders:', e))
      .finally(() => setFetching(false));
  }, []);

  const filtered = orders.filter(o => tab === 'All' || o.type === tab.toLowerCase().replace(' ', ''));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-800 text-text">Orders</h1>
        <p className="text-sm text-text-secondary mt-0.5">{fetching ? 'Loading…' : `${orders.length} total orders`}</p>
      </div>

      <div className="flex items-center bg-surface rounded-lg border border-border p-0.5 w-fit">
        {TYPE_TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-3 py-1.5 rounded-md text-xs font-700 transition-colors', tab === t ? 'bg-primary text-white' : 'text-text-secondary hover:text-text')}>
            {t}
          </button>
        ))}
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-text-muted font-600 border-b border-border bg-surface-2">
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Organisation</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3 font-mono font-700 text-text">{o.orderId}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2"><Avatar name={o.patientName} size="sm" /><span className="font-600 text-text">{o.patientName}</span></div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{o.orgName}</td>
                  <td className="px-4 py-3"><Badge variant={typeMap[o.type] || 'muted'} className="capitalize">{o.type}</Badge></td>
                  <td className="px-4 py-3 font-700 text-text">{formatCurrency(o.total)}</td>
                  <td className="px-4 py-3"><Badge variant={statusMap[o.status] || 'muted'} dot>{o.status.replace(/_/g, ' ')}</Badge></td>
                  <td className="px-4 py-3 text-text-muted">{new Date(o.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setViewing(o)} className="p-1.5 rounded-md hover:bg-surface-3 text-text-muted" title="View order">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* View order modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Order ${viewing?.orderId}`}>
        {viewing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Order ID', value: viewing.orderId },
                { label: 'Patient', value: viewing.patientName },
                { label: 'Organisation', value: viewing.orgName },
                { label: 'Type', value: viewing.type },
                { label: 'Total', value: formatCurrency(viewing.total) },
                { label: 'Status', value: viewing.status.replace(/_/g, ' ') },
                { label: 'Created At', value: new Date(viewing.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-surface-2 rounded-xl p-3">
                  <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider mb-1">{label}</p>
                  <p className="text-sm font-700 text-text capitalize">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
