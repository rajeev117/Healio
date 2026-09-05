'use client';
import { useState, useEffect } from 'react';
import { Check, X, Eye, MapPin, Clock, FileText, ExternalLink, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmModal, TextInputModal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { onboardingApi, auditApi } from '@/lib/api';

type VerificationDoc = { label: string; path: string | null; url: string | null };

type OrgItem = {
  id: string; name: string; type: string; city: string; country: string;
  appliedAt: string; contactName: string; contactEmail: string; contactPhone: string;
  documents: string[]; notes: string; status: 'pending' | 'approved' | 'rejected';
  address: string | null; latitude: number | null; longitude: number | null;
  // The uploaded KYC files, each with a short-lived signed URL. The private
  // verification-docs bucket cannot be read from the browser directly.
  docs: VerificationDoc[];
};

export default function OnboardingQueuePage() {
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    onboardingApi.list()
      .then((d) => setOrgs(d as OrgItem[]))
      .catch((e) => console.error('Failed to load onboarding queue:', e))
      .finally(() => setFetching(false));
  }, []);

  const pending = orgs.filter(o => o.status === 'pending');
  const selectedOrg = orgs.find(o => o.id === selected);

  const handleApprove = async () => {
    if (!selected || !selectedOrg) return;
    setLoading(true);
    try {
      await onboardingApi.approveOrg(selected);
      await auditApi.log('Approved organisation onboarding', 'Organisations', selectedOrg.name);
      setOrgs(prev => prev.map(o => o.id === selected ? { ...o, status: 'approved' } : o));
      setSelected(null);
      setModal(null);
    } catch (e) {
      console.error('Failed to approve:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!selected || !selectedOrg) return;
    setLoading(true);
    try {
      await onboardingApi.rejectOrg(selected, reason);
      await auditApi.log('Rejected organisation onboarding', 'Organisations', selectedOrg.name);
      setOrgs(prev => prev.map(o => o.id === selected ? { ...o, status: 'rejected' } : o));
      setSelected(null);
      setModal(null);
      setRejectReason('');
    } catch (e) {
      console.error('Failed to reject:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-800 text-text">Onboarding Queue</h1>
        <p className="text-sm text-text-secondary mt-0.5">{fetching ? 'Loading…' : `${pending.length} organisations pending approval`}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 space-y-3">
          {orgs.map(org => (
            <Card key={org.id} padding="md"
              className={cn('cursor-pointer transition-all',
                org.status !== 'pending' && 'opacity-50',
                selected === org.id ? 'ring-2 ring-primary' : 'hover:shadow-sm')}
              onClick={() => org.status === 'pending' && setSelected(org.id)}>
              <div className="flex items-start gap-3">
                <Avatar name={org.name} size="lg" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-800 text-text">{org.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-3 h-3 text-text-muted" />
                    <span className="text-[11px] text-text-secondary">{org.city}, {org.country}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="muted" className="capitalize">{org.type}</Badge>
                    <Badge variant={org.status === 'pending' ? 'warning' : org.status === 'approved' ? 'success' : 'danger'} dot>
                      {org.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-text-muted">
                    <Clock className="w-3 h-3" />
                    Applied {new Date(org.appliedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-2">
          {selectedOrg && selectedOrg.status === 'pending' ? (
            <Card padding="lg">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <Avatar name={selectedOrg.name} size="xl" />
                  <div>
                    <h2 className="text-lg font-800 text-text">{selectedOrg.name}</h2>
                    <p className="text-sm text-text-secondary">{selectedOrg.city}, {selectedOrg.country} · <span className="capitalize">{selectedOrg.type}</span></p>
                  </div>
                </div>
                <Badge variant="warning" dot>Pending Review</Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-surface-2 rounded-xl p-4">
                  <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider mb-3">Contact Person</p>
                  <p className="text-sm font-700 text-text">{selectedOrg.contactName}</p>
                  <p className="text-xs text-text-secondary mt-1">{selectedOrg.contactEmail}</p>
                  <p className="text-xs text-text-secondary">{selectedOrg.contactPhone}</p>
                </div>
                <div className="bg-surface-2 rounded-xl p-4">
                  <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider mb-3">
                    Documents Submitted
                  </p>
                  {selectedOrg.docs.length === 0 ? (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                      <p className="text-xs text-text-secondary">
                        No documents were uploaded with this application.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedOrg.docs.map((doc) => (
                        <div key={doc.label} className="flex items-center gap-2">
                          {doc.url ? (
                            <>
                              <FileText className="w-3.5 h-3.5 text-success shrink-0" />
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-600 text-primary hover:underline inline-flex items-center gap-1"
                              >
                                {doc.label}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
                              <span className="text-xs font-600 text-text-muted">
                                {doc.label} — file missing
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {(selectedOrg.address || selectedOrg.latitude != null) && (
                <div className="bg-surface-2 rounded-xl p-4 mb-6">
                  <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider mb-2">Address</p>
                  {selectedOrg.address && (
                    <p className="text-xs text-text-secondary leading-relaxed">{selectedOrg.address}</p>
                  )}
                  {selectedOrg.latitude != null && selectedOrg.longitude != null && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedOrg.latitude},${selectedOrg.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-700 text-primary hover:underline"
                    >
                      <MapPin className="w-3 h-3" />
                      {selectedOrg.latitude.toFixed(5)}, {selectedOrg.longitude.toFixed(5)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              <div className="bg-surface-2 rounded-xl p-4 mb-6">
                <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider mb-2">Notes</p>
                <p className="text-xs text-text-secondary leading-relaxed">{selectedOrg.notes}</p>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={() => setModal('approve')}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white text-sm font-700 rounded-xl hover:bg-primary-hover transition-colors">
                  <Check className="w-4 h-4" />
                  Approve & Onboard
                </button>
                <button onClick={() => { setModal('reject'); setRejectReason(''); }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-danger text-danger text-sm font-700 rounded-xl hover:bg-danger-soft transition-colors">
                  <X className="w-4 h-4" />
                  Reject
                </button>
              </div>
            </Card>
          ) : (
            <Card padding="lg" className="flex items-center justify-center h-64">
              <div className="text-center">
                <Eye className="w-8 h-8 text-border-strong mx-auto mb-2" />
                <p className="text-sm text-text-secondary font-600">Select an organisation to review</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      <ConfirmModal
        open={modal === 'approve'}
        onClose={() => setModal(null)}
        onConfirm={handleApprove}
        loading={loading}
        title="Approve Organisation"
        message={`Approve ${selectedOrg?.name} and onboard them to the platform? They will receive login credentials and become active immediately.`}
        confirmLabel="Approve & Onboard"
        confirmVariant="success"
      />

      <TextInputModal
        open={modal === 'reject'}
        onClose={() => setModal(null)}
        onConfirm={handleReject}
        loading={loading}
        title="Reject Organisation"
        label="Rejection reason"
        placeholder="Explain why this organisation is being rejected…"
        confirmLabel="Reject"
        confirmVariant="danger"
        value={rejectReason}
        onChange={setRejectReason}
      />
    </div>
  );
}
