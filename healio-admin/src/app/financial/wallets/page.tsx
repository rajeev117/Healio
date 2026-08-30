'use client';
import { useState, useEffect } from 'react';
import { Search, Wallet, Plus, Minus, Eye } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency, cn } from '@/lib/utils';
import { patientApi, transactionApi, auditApi } from '@/lib/api';
import type { Patient, Transaction } from '@/types';

type ModalState =
  | { type: 'adjust'; patient: Patient; mode: 'credit' | 'debit' }
  | { type: 'history'; patient: Patient }
  | null;

export default function WalletsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([patientApi.list(), transactionApi.list()])
      .then(([p, t]) => { setPatients(p); setTransactions(t); })
      .catch((e) => console.error('Failed to load wallets:', e))
      .finally(() => setFetching(false));
  }, []);

  const filtered = patients.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));
  const totalBalance = patients.reduce((s, p) => s + p.walletBalance, 0);

  const handleAdjust = async () => {
    if (modal?.type !== 'adjust') return;
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    setLoading(true);
    await patientApi.adjustWallet(modal.patient.id, val, modal.mode, note);
    await auditApi.log(`Wallet ${modal.mode}`, 'Financial', `${modal.patient.name} — ${formatCurrency(val)}`);
    setPatients(prev => prev.map(p => p.id === modal.patient.id
      ? { ...p, walletBalance: p.walletBalance + (modal.mode === 'credit' ? val : -val) }
      : p
    ));
    setLoading(false);
    setAmount('');
    setNote('');
    setModal(null);
  };

  const patientTxns = modal?.type === 'history'
    ? transactions.filter(t => t.userName === modal.patient.name)
    : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-800 text-text">Wallet Management</h1>
          <p className="text-sm text-text-secondary mt-0.5">{fetching ? 'Loading…' : 'View and adjust patient wallet balances'}</p>
        </div>
        <Card padding="sm" className="bg-primary-soft border-primary/20">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            <div>
              <p className="text-xs text-text-secondary font-600">Total Platform Balance</p>
              <p className="text-lg font-800 text-primary">{formatCurrency(totalBalance)}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
        <input type="text" placeholder="Search patient wallets..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-3 py-2 w-full bg-surface border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-text-muted font-600 border-b border-border bg-surface-2">
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Organisation</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Healio Plus</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={p.name} size="sm" />
                      <div>
                        <p className="font-700 text-text">{p.name}</p>
                        <p className="text-[10px] text-text-muted">{p.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{p.orgName}</td>
                  <td className="px-4 py-3">
                    <span className={cn('font-800', p.walletBalance > 0 ? 'text-text' : 'text-text-muted')}>
                      {formatCurrency(p.walletBalance)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={p.status === 'active' ? 'success' : p.status === 'banned' ? 'danger' : 'muted'} dot>{p.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={p.walletBalance >= 50 ? 'primary' : 'muted'} dot>
                      {p.walletBalance >= 50 ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => { setModal({ type: 'adjust', patient: p, mode: 'credit' }); setAmount(''); setNote(''); }}
                        className="p-1.5 rounded-md hover:bg-success-soft text-success" title="Credit wallet">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setModal({ type: 'adjust', patient: p, mode: 'debit' }); setAmount(''); setNote(''); }}
                        className="p-1.5 rounded-md hover:bg-danger-soft text-danger" title="Debit wallet">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setModal({ type: 'history', patient: p })}
                        className="p-1.5 rounded-md hover:bg-surface-3 text-text-muted" title="View history">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Adjust wallet modal */}
      <Modal
        open={modal?.type === 'adjust'}
        onClose={() => setModal(null)}
        title={modal?.type === 'adjust' ? `${modal.mode === 'credit' ? 'Credit' : 'Debit'} — ${modal.patient.name}` : ''}
        size="sm"
        footer={
          <>
            <button onClick={() => setModal(null)} className="px-4 py-2 text-xs font-700 text-text-secondary border border-border rounded-lg hover:text-text transition-colors">Cancel</button>
            <button onClick={handleAdjust} disabled={loading || !amount || parseFloat(amount) <= 0}
              className={cn(
                'px-4 py-2 text-xs font-700 text-white rounded-lg transition-colors',
                modal?.type === 'adjust' && modal.mode === 'credit' ? 'bg-success hover:bg-success/90' : 'bg-danger hover:bg-danger/90',
                (loading || !amount) && 'opacity-60 cursor-not-allowed',
              )}>
              {loading ? 'Processing…' : modal?.type === 'adjust' && modal.mode === 'credit' ? 'Credit' : 'Debit'}
            </button>
          </>
        }>
        {modal?.type === 'adjust' && (
          <div className="space-y-4">
            <div className="bg-surface-2 rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs text-text-secondary">Current Balance</span>
              <span className="text-sm font-800 text-primary">{formatCurrency(modal.patient.walletBalance)}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModal({ ...modal, mode: 'credit' })}
                className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-700 transition-colors',
                  modal.mode === 'credit' ? 'bg-success text-white border-success' : 'border-border text-text-secondary hover:border-success hover:text-success')}>
                <Plus className="w-3.5 h-3.5" />Credit
              </button>
              <button onClick={() => setModal({ ...modal, mode: 'debit' })}
                className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-700 transition-colors',
                  modal.mode === 'debit' ? 'bg-danger text-white border-danger' : 'border-border text-text-secondary hover:border-danger hover:text-danger')}>
                <Minus className="w-3.5 h-3.5" />Debit
              </button>
            </div>
            <div>
              <label className="block text-xs font-700 text-text mb-1.5">Amount (₹)</label>
              <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount"
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-700 text-text mb-1.5">Note (optional)</label>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for adjustment"
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
            </div>
          </div>
        )}
      </Modal>

      {/* Transaction history modal */}
      <Modal open={modal?.type === 'history'} onClose={() => setModal(null)} title={modal?.type === 'history' ? `Wallet History — ${modal.patient.name}` : ''}>
        {modal?.type === 'history' && (
          <div className="space-y-2">
            {patientTxns.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">No transactions found</p>
            ) : (
              patientTxns.map(t => (
                <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <div>
                    <p className="text-xs font-700 text-text capitalize">{t.type}</p>
                    <p className="text-[10px] text-text-muted">{new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · {t.method}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-xs font-800', t.type === 'refund' || t.type === 'topup' ? 'text-success' : 'text-text')}>
                      {t.type === 'refund' || t.type === 'topup' ? '+' : '-'}{formatCurrency(t.amount)}
                    </p>
                    <Badge variant={t.status === 'completed' ? 'success' : t.status === 'failed' ? 'danger' : 'warning'}>{t.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
