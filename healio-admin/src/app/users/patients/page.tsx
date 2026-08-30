'use client';
import { useState, useEffect } from 'react';
import { Search, Ban, Wallet, Eye, Plus, Minus, CheckCircle, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { cn, formatCurrency } from '@/lib/utils';
import { patientApi, auditApi } from '@/lib/api';
import type { Patient } from '@/types';

type ModalState =
  | { type: 'view'; patient: Patient }
  | { type: 'wallet'; patient: Patient; mode: 'credit' | 'debit' }
  | { type: 'ban'; patient: Patient }
  | { type: 'delete'; patient: Patient }
  | null;

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletNote, setWalletNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    patientApi.list()
      .then(setPatients)
      .catch((e) => console.error('Failed to load patients:', e))
      .finally(() => setFetching(false));
  }, []);

  const filtered = patients.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleBan = async () => {
    if (modal?.type !== 'ban') return;
    setLoading(true);
    const isBanned = modal.patient.status === 'banned';
    await patientApi[isBanned ? 'unban' : 'ban'](modal.patient.id);
    await auditApi.log(isBanned ? 'Unbanned patient' : 'Banned patient', 'Users', modal.patient.name);
    setPatients(prev => prev.map(p => p.id === modal.patient.id ? { ...p, status: isBanned ? 'active' : 'banned' } : p));
    setLoading(false);
    setModal(null);
  };

  const handleDelete = async () => {
    if (modal?.type !== 'delete') return;
    setLoading(true);
    try {
      await patientApi.remove(modal.patient.id);
      await auditApi.log('Deleted patient', 'Users', modal.patient.name);
      setPatients(prev => prev.filter(p => p.id !== modal.patient.id));
    } catch (e) {
      console.error('Delete failed:', e);
    }
    setLoading(false);
    setModal(null);
  };

  const handleWalletAdjust = async () => {
    if (modal?.type !== 'wallet') return;
    const amount = parseFloat(walletAmount);
    if (!amount || amount <= 0) return;
    setLoading(true);
    await patientApi.adjustWallet(modal.patient.id, amount, modal.mode, walletNote);
    await auditApi.log(`Wallet ${modal.mode}`, 'Financial', `${modal.patient.name} — ${formatCurrency(amount)}`);
    setPatients(prev => prev.map(p => p.id === modal.patient.id
      ? { ...p, walletBalance: p.walletBalance + (modal.mode === 'credit' ? amount : -amount) }
      : p
    ));
    setLoading(false);
    setWalletAmount('');
    setWalletNote('');
    setModal(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-800 text-text">Patients</h1>
          <p className="text-sm text-text-secondary mt-0.5">{fetching ? 'Loading…' : `${patients.length} patients across all organisations`}</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
        <input type="text" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-3 py-2 w-full bg-surface border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-text-muted font-600 border-b border-border bg-surface-2">
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Organisation</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Wallet</th>
                <th className="px-4 py-3">Appointments</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Active</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
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
                  <td className="px-4 py-3 text-text-secondary font-mono text-[10px]">{p.phone}</td>
                  <td className="px-4 py-3 font-700 text-text">{formatCurrency(p.walletBalance)}</td>
                  <td className="px-4 py-3 text-text-secondary">{p.appointmentCount}</td>
                  <td className="px-4 py-3">
                    <Badge variant={p.status === 'active' ? 'success' : p.status === 'banned' ? 'danger' : 'muted'} dot>{p.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{new Date(p.lastActiveAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setModal({ type: 'view', patient: p })}
                        className="p-1.5 rounded-md hover:bg-surface-3 text-text-muted" title="View profile">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setModal({ type: 'wallet', patient: p, mode: 'credit' }); setWalletAmount(''); setWalletNote(''); }}
                        className="p-1.5 rounded-md hover:bg-surface-3 text-text-muted" title="Adjust wallet">
                        <Wallet className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setModal({ type: 'ban', patient: p })}
                        className={cn('p-1.5 rounded-md transition-colors', p.status === 'banned' ? 'hover:bg-success-soft text-success' : 'hover:bg-danger-soft text-danger')}
                        title={p.status === 'banned' ? 'Unban patient' : 'Ban patient'}>
                        {p.status === 'banned' ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setModal({ type: 'delete', patient: p })}
                        className="p-1.5 rounded-md hover:bg-danger-soft text-danger transition-colors"
                        title="Delete patient (permanent)">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* View patient modal */}
      <Modal open={modal?.type === 'view'} onClose={() => setModal(null)} title="Patient Profile">
        {modal?.type === 'view' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={modal.patient.name} size="xl" />
              <div>
                <p className="text-base font-800 text-text">{modal.patient.name}</p>
                <p className="text-xs text-text-secondary">{modal.patient.email}</p>
                <p className="text-xs text-text-secondary">{modal.patient.phone}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Organisation', value: modal.patient.orgName },
                { label: 'Status', value: modal.patient.status },
                { label: 'Wallet Balance', value: formatCurrency(modal.patient.walletBalance) },
                { label: 'Total Appointments', value: String(modal.patient.appointmentCount) },
                { label: 'Joined', value: new Date(modal.patient.joinedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
                { label: 'Last Active', value: new Date(modal.patient.lastActiveAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
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

      {/* Wallet adjust modal */}
      <Modal
        open={modal?.type === 'wallet'}
        onClose={() => setModal(null)}
        title={modal?.type === 'wallet' ? `Adjust Wallet — ${modal.patient.name}` : 'Adjust Wallet'}
        size="sm"
        footer={
          <>
            <button onClick={() => setModal(null)} className="px-4 py-2 text-xs font-700 text-text-secondary border border-border rounded-lg hover:text-text transition-colors">
              Cancel
            </button>
            <button
              onClick={handleWalletAdjust}
              disabled={loading || !walletAmount || parseFloat(walletAmount) <= 0}
              className={cn(
                'px-4 py-2 text-xs font-700 text-white rounded-lg transition-colors',
                modal?.type === 'wallet' && modal.mode === 'credit' ? 'bg-success hover:bg-success/90' : 'bg-danger hover:bg-danger/90',
                (loading || !walletAmount) && 'opacity-60 cursor-not-allowed',
              )}>
              {loading ? 'Processing…' : modal?.type === 'wallet' && modal.mode === 'credit' ? 'Credit Wallet' : 'Debit Wallet'}
            </button>
          </>
        }>
        {modal?.type === 'wallet' && (
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
              <input type="number" min="1" value={walletAmount} onChange={(e) => setWalletAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-700 text-text mb-1.5">Note (optional)</label>
              <input type="text" value={walletNote} onChange={(e) => setWalletNote(e.target.value)}
                placeholder="Reason for adjustment"
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
            </div>
          </div>
        )}
      </Modal>

      {/* Ban / Unban modal */}
      <ConfirmModal
        open={modal?.type === 'ban'}
        onClose={() => setModal(null)}
        onConfirm={handleBan}
        loading={loading}
        title={modal?.type === 'ban' && modal.patient.status === 'banned' ? 'Unban Patient' : 'Ban Patient'}
        message={
          modal?.type === 'ban'
            ? modal.patient.status === 'banned'
              ? `Unban ${modal.patient.name}? They will regain access to the platform.`
              : `Ban ${modal.patient.name}? They will be locked out of the platform immediately.`
            : ''
        }
        confirmLabel={modal?.type === 'ban' && modal.patient.status === 'banned' ? 'Unban' : 'Ban Patient'}
        confirmVariant={modal?.type === 'ban' && modal.patient.status === 'banned' ? 'success' : 'danger'}
      />

      {/* Delete patient modal */}
      <ConfirmModal
        open={modal?.type === 'delete'}
        onClose={() => setModal(null)}
        onConfirm={handleDelete}
        loading={loading}
        title="Delete Patient"
        message={
          modal?.type === 'delete'
            ? `Permanently delete ${modal.patient.name}? This removes their account, appointments, and records from the database. The phone number can then be registered again. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete Permanently"
        confirmVariant="danger"
      />
    </div>
  );
}
