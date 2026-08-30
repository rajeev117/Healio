'use client';
import { useState, useEffect } from 'react';
import { Search, ArrowUpCircle, ArrowDownCircle, RefreshCcw, Shield } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { cn, formatCurrency } from '@/lib/utils';
import { transactionApi } from '@/lib/api';
import type { Transaction } from '@/types';

const typeIcons: Record<string, typeof ArrowUpCircle> = {
  topup: ArrowUpCircle, payment: ArrowDownCircle, refund: RefreshCcw, subscription: Shield,
};
const typeColors: Record<string, string> = {
  topup: 'text-success', payment: 'text-primary', refund: 'text-warning', subscription: 'text-info',
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    transactionApi.list()
      .then(setTransactions)
      .catch((e) => console.error('Failed to load transactions:', e))
      .finally(() => setFetching(false));
  }, []);

  const filtered = transactions.filter(t => !search || t.userName.toLowerCase().includes(search.toLowerCase()));
  const totalCompleted = transactions.filter(t => t.status === 'completed').reduce((s, t) => s + (t.type === 'topup' || t.type === 'payment' ? t.amount : 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-800 text-text">Transactions</h1>
          <p className="text-sm text-text-secondary mt-0.5">{fetching ? 'Loading…' : 'Full platform transaction ledger'}</p>
        </div>
        <Badge variant="success">Volume: {formatCurrency(totalCompleted)}</Badge>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
        <input type="text" placeholder="Search by user..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-3 py-2 w-full bg-surface border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-text-muted font-600 border-b border-border bg-surface-2">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Organisation</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((tx) => {
                const Icon = typeIcons[tx.type] || ArrowDownCircle;
                return (
                  <tr key={tx.id} className="hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Icon className={cn('w-4 h-4', typeColors[tx.type])} />
                        <span className="font-700 text-text capitalize">{tx.type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2"><Avatar name={tx.userName} size="sm" /><span className="font-600 text-text">{tx.userName}</span></div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{tx.orgName}</td>
                    <td className="px-4 py-3 font-800 text-text">{formatCurrency(tx.amount)}</td>
                    <td className="px-4 py-3"><Badge variant="muted" className="uppercase">{tx.method}</Badge></td>
                    <td className="px-4 py-3">
                      <Badge variant={tx.status === 'completed' ? 'success' : tx.status === 'pending' ? 'warning' : 'danger'} dot>{tx.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {new Date(tx.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
