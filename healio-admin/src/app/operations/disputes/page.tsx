'use client';
import { useState, useEffect } from 'react';
import { AlertTriangle, MessageSquare, Check, Clock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmModal, TextInputModal } from '@/components/ui/Modal';
import { cn, timeAgo } from '@/lib/utils';
import { disputeApi, auditApi } from '@/lib/api';

type Dispute = {
  id: string; patientName: string; orgName: string; subject: string; category: string;
  priority: string; status: 'open' | 'resolved'; createdAt: string;
  messages: number; assignedTo: string | null;
};

const priorityMap: Record<string, 'danger' | 'warning' | 'info' | 'muted'> = {
  urgent: 'danger', high: 'warning', medium: 'info', low: 'muted',
};

const STATUS_TABS = ['All', 'Open', 'Resolved'] as const;

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [fetching, setFetching] = useState(true);
  const [tab, setTab] = useState('All');
  const [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState<'respond' | 'resolve' | null>(null);
  const [responseText, setResponseText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    disputeApi.list()
      .then((d) => setDisputes(d as Dispute[]))
      .catch((e) => console.error('Failed to load disputes:', e))
      .finally(() => setFetching(false));
  }, []);

  const filtered = disputes.filter(d => tab === 'All' || d.status === tab.toLowerCase());
  const selectedDispute = disputes.find(d => d.id === selected);

  const handleRespond = async (message: string) => {
    if (!selected || !selectedDispute) return;
    setLoading(true);
    await disputeApi.respond(selected, message);
    setDisputes(prev => prev.map(d => d.id === selected ? { ...d, messages: d.messages + 1 } : d));
    setLoading(false);
    setModal(null);
    setResponseText('');
  };

  const handleResolve = async () => {
    if (!selected || !selectedDispute) return;
    setLoading(true);
    await disputeApi.resolve(selected);
    await auditApi.log('Resolved dispute', 'Operations', selectedDispute.subject);
    setDisputes(prev => prev.map(d => d.id === selected ? { ...d, status: 'resolved' } : d));
    setSelected(null);
    setLoading(false);
    setModal(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-800 text-text">Disputes & Complaints</h1>
          <p className="text-sm text-text-secondary mt-0.5">{fetching ? 'Loading…' : `${disputes.filter(d => d.status === 'open').length} open disputes`}</p>
        </div>
        <Badge variant="danger" dot>{disputes.filter(d => d.priority === 'urgent' && d.status === 'open').length} urgent</Badge>
      </div>

      <div className="flex items-center bg-surface rounded-lg border border-border p-0.5 w-fit">
        {STATUS_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-3 py-1.5 rounded-md text-xs font-700 transition-colors', tab === t ? 'bg-primary text-white' : 'text-text-secondary hover:text-text')}>
            {t} {t === 'Open' && `(${disputes.filter(d => d.status === 'open').length})`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-2">
          {filtered.map(d => (
            <Card key={d.id} padding="none"
              className={cn('cursor-pointer transition-all', selected === d.id ? 'ring-2 ring-primary' : 'hover:shadow-sm', d.priority === 'urgent' && d.status === 'open' && 'border-danger/30')}
              onClick={() => setSelected(d.id)}>
              <div className="flex items-start gap-3 px-4 py-3">
                <Avatar name={d.patientName} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-700 text-text line-clamp-1">{d.subject}</p>
                    <Badge variant={d.status === 'open' ? 'warning' : 'success'} dot>{d.status}</Badge>
                  </div>
                  <p className="text-[11px] text-text-secondary mt-0.5">{d.patientName} · {d.orgName}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <Badge variant={priorityMap[d.priority]}>{d.priority}</Badge>
                    <Badge variant="muted">{d.category}</Badge>
                    <span className="flex items-center gap-1 text-[10px] text-text-muted"><MessageSquare className="w-3 h-3" />{d.messages}</span>
                    <span className="text-[10px] text-text-muted">{timeAgo(d.createdAt)}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-text-muted">No {tab.toLowerCase()} disputes</div>
          )}
        </div>

        <div className="lg:col-span-2">
          {selectedDispute ? (
            <Card padding="lg" className="sticky top-5">
              <div className="flex items-center gap-3 mb-4">
                <Avatar name={selectedDispute.patientName} size="lg" />
                <div>
                  <p className="text-sm font-800 text-text">{selectedDispute.patientName}</p>
                  <p className="text-xs text-text-secondary">{selectedDispute.orgName}</p>
                </div>
              </div>
              <p className="text-sm font-700 text-text mb-2">{selectedDispute.subject}</p>
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <Badge variant={priorityMap[selectedDispute.priority]}>{selectedDispute.priority} priority</Badge>
                <Badge variant="muted">{selectedDispute.category}</Badge>
                <Badge variant={selectedDispute.status === 'open' ? 'warning' : 'success'} dot>{selectedDispute.status}</Badge>
              </div>
              <div className="bg-surface-2 rounded-xl p-4 mb-4">
                <span className="text-[10px] font-700 text-text-muted uppercase">Assigned To</span>
                {selectedDispute.assignedTo ? (
                  <div className="flex items-center gap-2 mt-2">
                    <Avatar name={selectedDispute.assignedTo} size="sm" />
                    <span className="text-xs font-700 text-text">{selectedDispute.assignedTo}</span>
                  </div>
                ) : (
                  <p className="text-xs text-warning font-600 mt-1">Unassigned — needs assignment</p>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-text-muted mb-4">
                <Clock className="w-3 h-3" />
                <span>Created {timeAgo(selectedDispute.createdAt)} · {selectedDispute.messages} messages</span>
              </div>
              {selectedDispute.status === 'open' && (
                <div className="flex items-center gap-2">
                  <button onClick={() => { setModal('respond'); setResponseText(''); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-primary text-white text-xs font-700 rounded-lg hover:bg-primary-hover transition-colors">
                    <MessageSquare className="w-3.5 h-3.5" />Respond
                  </button>
                  <button onClick={() => setModal('resolve')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-success text-success text-xs font-700 rounded-lg hover:bg-success-soft transition-colors">
                    <Check className="w-3.5 h-3.5" />Resolve
                  </button>
                </div>
              )}
            </Card>
          ) : (
            <Card padding="lg" className="flex items-center justify-center h-48">
              <p className="text-sm text-text-secondary font-600">Select a dispute to view details</p>
            </Card>
          )}
        </div>
      </div>

      <TextInputModal
        open={modal === 'respond'}
        onClose={() => setModal(null)}
        onConfirm={handleRespond}
        loading={loading}
        title="Respond to Dispute"
        label="Your response"
        placeholder="Write your response to the patient…"
        confirmLabel="Send Response"
        confirmVariant="primary"
        value={responseText}
        onChange={setResponseText}
      />

      <ConfirmModal
        open={modal === 'resolve'}
        onClose={() => setModal(null)}
        onConfirm={handleResolve}
        loading={loading}
        title="Mark as Resolved"
        message={selectedDispute ? `Mark "${selectedDispute.subject}" as resolved? The patient will be notified.` : ''}
        confirmLabel="Mark Resolved"
        confirmVariant="success"
      />
    </div>
  );
}
