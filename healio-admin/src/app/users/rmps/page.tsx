'use client';
import { useState, useEffect } from 'react';
import { Search, ShieldCheck, Ban, Eye } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { rmpApi, auditApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { Rmp } from '@/types';

type ModalState =
  | { type: 'view'; rmp: Rmp }
  | { type: 'suspend'; rmp: Rmp }
  | { type: 'activate'; rmp: Rmp }
  | null;

const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function RmpsPage() {
  const [rmps, setRmps] = useState<Rmp[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [modal, setModal] = useState<ModalState>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    rmpApi.list()
      .then(setRmps)
      .catch((e) => console.error('Failed to load healthcare consultants:', e))
      .finally(() => setFetching(false));
  }, []);

  const filtered = rmps.filter(r =>
    (statusFilter === 'All' || r.status === statusFilter.toLowerCase()) &&
    (!search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.phone.includes(search) ||
      (r.village ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  const applyStatus = async (next: 'active' | 'suspended') => {
    const m = modal;
    if (m?.type !== 'suspend' && m?.type !== 'activate') return;
    setLoading(true);
    try {
      if (next === 'active') await rmpApi.activate(m.rmp.id);
      else await rmpApi.suspend(m.rmp.id);
      await auditApi.log(next === 'active' ? 'Activated Healthcare Consultant' : 'Suspended Healthcare Consultant', 'Users', m.rmp.name);
      setRmps(prev => prev.map(r => r.id === m.rmp.id ? { ...r, status: next } : r));
    } catch (e) {
      console.error('Healthcare consultant status update failed:', e);
    } finally {
      setLoading(false);
      setModal(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-800 text-text">Healthcare Consultants</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          {fetching ? 'Loading…' : `${rmps.length} healthcare consultant${rmps.length === 1 ? '' : 's'}`}
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input type="text" placeholder="Search by name, phone, village..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 w-full bg-surface border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
        </div>
        <div className="flex items-center gap-1">
          {['All', 'Active', 'Suspended'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-600 ${statusFilter === s ? 'bg-primary text-white' : 'bg-surface border border-border text-text-secondary'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-text-muted font-600 border-b border-border bg-surface-2">
                <th className="px-4 py-3">Consultant</th>
                <th className="px-4 py-3">Phone (login)</th>
                <th className="px-4 py-3">Village / Area</th>
                <th className="px-4 py-3">Patients</th>
                <th className="px-4 py-3">Bookings</th>
                <th className="px-4 py-3">Partner Incentive</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!fetching && filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-text-muted">No healthcare consultants found.</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.name} size="sm" />
                      <div>
                        <p className="font-700 text-text">{r.name}</p>
                        {r.regNo && <p className="text-[10px] text-text-muted">Reg: {r.regNo}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary font-mono text-[10px]">{r.phone || '—'}</td>
                  <td className="px-4 py-3 text-text-secondary">{r.village || r.address || '—'}</td>
                  <td className="px-4 py-3 text-text font-700">{r.patientCount}</td>
                  <td className="px-4 py-3 text-text font-700">{r.bookingCount}</td>
                  <td className="px-4 py-3 text-text font-700">{formatCurrency(r.commission)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.status === 'active' ? 'success' : 'danger'} dot>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{fmtDate(r.joinedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setModal({ type: 'view', rmp: r })}
                        className="p-1.5 rounded-md hover:bg-surface-3 text-text-muted" title="View profile">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {r.status === 'active' ? (
                        <button onClick={() => setModal({ type: 'suspend', rmp: r })}
                          className="p-1.5 rounded-md hover:bg-danger-soft text-danger" title="Suspend healthcare consultant">
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button onClick={() => setModal({ type: 'activate', rmp: r })}
                          className="p-1.5 rounded-md hover:bg-success-soft text-success" title="Activate healthcare consultant">
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* View healthcare consultant modal */}
      <Modal open={modal?.type === 'view'} onClose={() => setModal(null)} title="Healthcare Consultant Profile">
        {modal?.type === 'view' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={modal.rmp.name} size="xl" />
              <div>
                <p className="text-base font-800 text-text">{modal.rmp.name}</p>
                <p className="text-xs text-text-secondary">Healthcare Consultant</p>
                <Badge variant={modal.rmp.status === 'active' ? 'success' : 'danger'} dot className="mt-1">{modal.rmp.status}</Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Phone (login)', value: modal.rmp.phone || '—' },
                { label: 'Email', value: modal.rmp.email || '—' },
                { label: 'Village / Area', value: modal.rmp.village || '—' },
                { label: 'Address', value: modal.rmp.address || '—' },
                { label: 'Reg. No.', value: modal.rmp.regNo || '—' },
                { label: 'Joined', value: fmtDate(modal.rmp.joinedAt) },
                { label: 'Linked Patients', value: String(modal.rmp.patientCount) },
                { label: 'Bookings Made', value: String(modal.rmp.bookingCount) },
                { label: 'Partner Incentive Earned', value: formatCurrency(modal.rmp.commission) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-surface-2 rounded-xl p-3">
                  <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider mb-1">{label}</p>
                  <p className="text-sm font-700 text-text">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Suspend modal */}
      <ConfirmModal
        open={modal?.type === 'suspend'}
        onClose={() => setModal(null)}
        onConfirm={() => applyStatus('suspended')}
        loading={loading}
        title="Suspend Healthcare Consultant"
        message={modal?.type === 'suspend' ? `Suspend ${modal.rmp.name}? They won't be able to sign in or book on behalf of patients until reactivated.` : ''}
        confirmLabel="Suspend"
        confirmVariant="danger"
      />

      {/* Activate modal */}
      <ConfirmModal
        open={modal?.type === 'activate'}
        onClose={() => setModal(null)}
        onConfirm={() => applyStatus('active')}
        loading={loading}
        title="Activate Healthcare Consultant"
        message={modal?.type === 'activate' ? `Activate ${modal.rmp.name}? They will regain access to the healthcare consultant portal.` : ''}
        confirmLabel="Activate"
        confirmVariant="success"
      />
    </div>
  );
}
