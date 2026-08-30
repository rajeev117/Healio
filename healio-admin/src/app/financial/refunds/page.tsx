'use client';
import { useState, useEffect } from 'react';
import { Check, X, Clock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmModal, TextInputModal } from '@/components/ui/Modal';
import { formatCurrency, timeAgo, cn } from '@/lib/utils';
import { refundApi, auditApi } from '@/lib/api';

type Refund = {
  id: string; userName: string; orgName: string; amount: number; reason: string;
  status: 'pending' | 'approved' | 'rejected'; method: string; requestedAt: string;
};

const STATUS_TABS = ['Pending', 'Approved', 'Rejected'] as const;

export default function RefundsPage() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [fetching, setFetching] = useState(true);
  const [tab, setTab] = useState<string>('Pending');
  const [modal, setModal] = useState<{ type: 'approve' | 'reject'; refund: Refund } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    refundApi.list()
      .then((d) => setRefunds(d as Refund[]))
      .catch((e) => console.error('Failed to load refunds:', e))
      .finally(() => setFetching(false));
  }, []);

  const filtered = refunds.filter(r => r.status === tab.toLowerCase());
  const totalPending = refunds.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0);

  const handleApprove = async () => {
    if (modal?.type !== 'approve') return;
    setLoading(true);
    await refundApi.approve(modal.refund.id);
    await auditApi.log('Approved refund', 'Financial', `${modal.refund.userName} — ${formatCurrency(modal.refund.amount)}`);
    setRefunds(prev => prev.map(r => r.id === modal.refund.id ? { ...r, status: 'approved' } : r));
    setLoading(false);
    setModal(null);
  };

  const handleReject = async (reason: string) => {
    if (modal?.type !== 'reject') return;
    setLoading(true);
    await refundApi.reject(modal.refund.id, reason);
    await auditApi.log('Rejected refund', 'Financial', `${modal.refund.userName} — ${formatCurrency(modal.refund.amount)}`);
    setRefunds(prev => prev.map(r => r.id === modal.refund.id ? { ...r, status: 'rejected' } : r));
    setLoading(false);
    setModal(null);
    setRejectReason('');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-800 text-text">Refunds</h1>
          <p className="text-sm text-text-secondary mt-0.5">{fetching ? 'Loading…' : `${refunds.filter(r => r.status === 'pending').length} pending approval · ${formatCurrency(totalPending)} total`}</p>
        </div>
        <Badge variant="warning" dot>{refunds.filter(r => r.status === 'pending').length} pending</Badge>
      </div>

      <div className="flex items-center bg-surface rounded-lg border border-border p-0.5 w-fit">
        {STATUS_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-3 py-1.5 rounded-md text-xs font-700 transition-colors', tab === t ? 'bg-primary text-white' : 'text-text-secondary hover:text-text')}>
            {t} ({refunds.filter(r => r.status === t.toLowerCase()).length})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(refund => (
          <Card key={refund.id} padding="none">
            <div className="flex items-center gap-4 px-5 py-4">
              <Avatar name={refund.userName} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-800 text-text">{refund.userName}</p>
                  <span className="text-xs text-text-muted">·</span>
                  <span className="text-xs text-text-secondary">{refund.orgName}</span>
                </div>
                <p className="text-xs text-text-secondary">{refund.reason}</p>
                <div className="flex items-center gap-3 mt-2">
                  <Badge variant="muted" className="uppercase">{refund.method}</Badge>
                  <span className="flex items-center gap-1 text-[10px] text-text-muted">
                    <Clock className="w-3 h-3" />{timeAgo(refund.requestedAt)}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-800 text-text">{formatCurrency(refund.amount)}</p>
                {refund.status === 'pending' && (
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => setModal({ type: 'approve', refund })}
                      className="flex items-center gap-1 px-3 py-1.5 bg-success text-white text-xs font-700 rounded-lg hover:bg-success/90 transition-colors">
                      <Check className="w-3.5 h-3.5" />Approve
                    </button>
                    <button onClick={() => { setModal({ type: 'reject', refund }); setRejectReason(''); }}
                      className="flex items-center gap-1 px-3 py-1.5 border border-danger text-danger text-xs font-700 rounded-lg hover:bg-danger-soft transition-colors">
                      <X className="w-3.5 h-3.5" />Reject
                    </button>
                  </div>
                )}
                {refund.status === 'approved' && <Badge variant="success" dot>Approved</Badge>}
                {refund.status === 'rejected' && <Badge variant="danger" dot>Rejected</Badge>}
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-text-muted">No {tab.toLowerCase()} refunds</div>
        )}
      </div>

      <ConfirmModal
        open={modal?.type === 'approve'}
        onClose={() => setModal(null)}
        onConfirm={handleApprove}
        loading={loading}
        title="Approve Refund"
        message={modal ? `Approve ${formatCurrency(modal.refund.amount)} refund for ${modal.refund.userName}? Amount will be returned via ${modal.refund.method}.` : ''}
        confirmLabel="Approve Refund"
        confirmVariant="success"
      />

      <TextInputModal
        open={modal?.type === 'reject'}
        onClose={() => setModal(null)}
        onConfirm={handleReject}
        loading={loading}
        title="Reject Refund"
        label="Reason for rejection"
        placeholder="Explain why this refund is being rejected…"
        confirmLabel="Reject Refund"
        confirmVariant="danger"
        value={rejectReason}
        onChange={setRejectReason}
      />
    </div>
  );
}
