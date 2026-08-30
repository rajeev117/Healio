'use client';
import { useState, useEffect } from 'react';
import { Search, ShieldCheck, Eye, Star } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { providerApi, auditApi } from '@/lib/api';
import type { Provider } from '@/types';

type ModalState =
  | { type: 'view'; provider: Provider }
  | { type: 'verify'; provider: Provider }
  | null;

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    providerApi.list()
      .then(setProviders)
      .catch((e) => console.error('Failed to load providers:', e))
      .finally(() => setFetching(false));
  }, []);

  const filtered = providers.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  const handleVerify = async () => {
    if (modal?.type !== 'verify') return;
    setLoading(true);
    await providerApi.verify(modal.provider.id);
    await auditApi.log('Verified provider', 'Users', modal.provider.name);
    setProviders(prev => prev.map(p => p.id === modal.provider.id
      ? { ...p, status: 'active', verifiedAt: new Date().toISOString() }
      : p
    ));
    setLoading(false);
    setModal(null);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-800 text-text">Providers</h1>
        <p className="text-sm text-text-secondary mt-0.5">{fetching ? 'Loading…' : `${providers.length} providers across all organisations`}</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
        <input type="text" placeholder="Search providers..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-3 py-2 w-full bg-surface border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-text-muted font-600 border-b border-border bg-surface-2">
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Phone (login)</th>
                <th className="px-4 py-3">Organisation</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
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
                        {p.specialty && <p className="text-[10px] text-text-muted">{p.specialty}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge variant="muted" className="capitalize">{p.type}</Badge></td>
                  <td className="px-4 py-3 text-text-secondary font-mono text-[10px]">{p.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-text-secondary">{p.orgName}</td>
                  <td className="px-4 py-3">
                    {p.rating > 0 ? (
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-warning fill-warning" />
                        <span className="font-700 text-text">{p.rating}</span>
                      </div>
                    ) : <span className="text-text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={p.status === 'active' ? 'success' : p.status === 'pending_verification' ? 'warning' : 'danger'} dot>
                      {p.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{new Date(p.joinedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setModal({ type: 'view', provider: p })}
                        className="p-1.5 rounded-md hover:bg-surface-3 text-text-muted" title="View profile">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {p.status === 'pending_verification' && (
                        <button onClick={() => setModal({ type: 'verify', provider: p })}
                          className="p-1.5 rounded-md hover:bg-success-soft text-success" title="Verify provider">
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

      {/* View provider modal */}
      <Modal open={modal?.type === 'view'} onClose={() => setModal(null)} title="Provider Profile">
        {modal?.type === 'view' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={modal.provider.name} size="xl" />
              <div>
                <p className="text-base font-800 text-text">{modal.provider.name}</p>
                {modal.provider.specialty && <p className="text-xs text-text-secondary">{modal.provider.specialty}</p>}
                <Badge variant={modal.provider.status === 'active' ? 'success' : modal.provider.status === 'pending_verification' ? 'warning' : 'danger'} dot className="mt-1">
                  {modal.provider.status.replace('_', ' ')}
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Type', value: modal.provider.type },
                { label: 'Phone (login)', value: modal.provider.phone ?? '—' },
                { label: 'Department', value: modal.provider.department ?? '—' },
                { label: 'Organisation', value: modal.provider.orgName },
                { label: 'Rating', value: modal.provider.rating > 0 ? `${modal.provider.rating} / 5` : 'Not rated yet' },
                { label: 'Joined', value: new Date(modal.provider.joinedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
                { label: 'Verified At', value: modal.provider.verifiedAt ? new Date(modal.provider.verifiedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not verified' },
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

      {/* Verify modal */}
      <ConfirmModal
        open={modal?.type === 'verify'}
        onClose={() => setModal(null)}
        onConfirm={handleVerify}
        loading={loading}
        title="Verify Provider"
        message={modal?.type === 'verify' ? `Verify ${modal.provider.name}? They will be marked as active and visible to patients.` : ''}
        confirmLabel="Verify & Activate"
        confirmVariant="success"
      />
    </div>
  );
}
