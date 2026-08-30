'use client';
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { TextInputModal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { slaApi, auditApi } from '@/lib/api';

const SLA_RULES = [
  { id: 'sla1', name: 'Appointment Wait Time', threshold: '< 15 min', current: '8 min', compliance: 94, status: 'healthy' },
  { id: 'sla2', name: 'Pharmacy Delivery Time', threshold: '< 60 min', current: '42 min', compliance: 87, status: 'healthy' },
  { id: 'sla3', name: 'Lab Report Turnaround', threshold: '< 48 hours', current: '38 hours', compliance: 91, status: 'healthy' },
  { id: 'sla4', name: 'Home Care Response', threshold: '< 2 hours', current: '1.5 hours', compliance: 82, status: 'warning' },
  { id: 'sla5', name: 'Dispute Resolution', threshold: '< 24 hours', current: '28 hours', compliance: 68, status: 'breach' },
  { id: 'sla6', name: 'Refund Processing', threshold: '< 72 hours', current: '48 hours', compliance: 95, status: 'healthy' },
];

const INITIAL_BREACHES = [
  { id: 'b1', rule: 'Dispute Resolution', target: 'Dispute #d1 — Nadia Kaur', org: 'LifeCare Centre', overdue: '4 hours', severity: 'high' },
  { id: 'b2', rule: 'Home Care Response', target: 'Order #HC-50120', org: 'City Hospital', overdue: '30 min', severity: 'medium' },
  { id: 'b3', rule: 'Dispute Resolution', target: 'Dispute #d2 — Farhan Ali', org: 'MediCare Clinic', overdue: '2 hours', severity: 'medium' },
];

type Breach = typeof INITIAL_BREACHES[number];

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  healthy: { color: 'text-success', bg: 'bg-success-soft', label: 'Healthy' },
  warning: { color: 'text-warning', bg: 'bg-warning-soft', label: 'At Risk' },
  breach: { color: 'text-danger', bg: 'bg-danger-soft', label: 'Breached' },
};

export default function SLAMonitorPage() {
  const [breaches, setBreaches] = useState(INITIAL_BREACHES);
  const [escalating, setEscalating] = useState<Breach | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEscalate = async (noteText: string) => {
    if (!escalating) return;
    setLoading(true);
    await slaApi.escalate(escalating.id, noteText);
    await auditApi.log('Escalated SLA breach', 'Operations', escalating.target);
    setBreaches(prev => prev.filter(b => b.id !== escalating.id));
    setLoading(false);
    setEscalating(null);
    setNote('');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-800 text-text">SLA Monitor</h1>
          <p className="text-sm text-text-secondary mt-0.5">Service level agreement compliance tracking</p>
        </div>
        {breaches.length > 0 ? (
          <Badge variant="danger" dot>{breaches.length} active breach{breaches.length > 1 ? 'es' : ''}</Badge>
        ) : (
          <Badge variant="success" dot>All SLAs met</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SLA_RULES.map(sla => {
          const s = statusConfig[sla.status];
          return (
            <Card key={sla.id} padding="md" className={cn(sla.status === 'breach' && 'border-danger/30')}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-800 text-text">{sla.name}</p>
                <Badge variant={sla.status === 'healthy' ? 'success' : sla.status === 'warning' ? 'warning' : 'danger'} dot>{s.label}</Badge>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-secondary">Target: {sla.threshold}</span>
                <span className="text-xs font-700 text-text">Current: {sla.current}</span>
              </div>
              <div className="h-2 bg-surface-3 rounded-full overflow-hidden mb-2">
                <div
                  className={cn('h-full rounded-full transition-all', sla.compliance >= 90 ? 'bg-success' : sla.compliance >= 75 ? 'bg-warning' : 'bg-danger')}
                  style={{ width: `${sla.compliance}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-muted">Compliance</span>
                <span className={cn('text-xs font-800', sla.compliance >= 90 ? 'text-success' : sla.compliance >= 75 ? 'text-warning' : 'text-danger')}>
                  {sla.compliance}%
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      <Card padding="md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-danger" />
            <CardTitle>Active Breaches</CardTitle>
          </div>
          <Badge variant="danger">{breaches.length}</Badge>
        </CardHeader>
        {breaches.length === 0 ? (
          <p className="text-sm text-text-muted py-4 text-center">No active breaches</p>
        ) : (
          <div className="space-y-2">
            {breaches.map(breach => (
              <div key={breach.id} className={cn(
                'flex items-center gap-4 px-4 py-3 rounded-xl border',
                breach.severity === 'high' ? 'bg-danger-soft/30 border-danger/20' : 'bg-warning-soft/30 border-warning/20'
              )}>
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  breach.severity === 'high' ? 'bg-danger-soft' : 'bg-warning-soft')}>
                  <AlertTriangle className={cn('w-4 h-4', breach.severity === 'high' ? 'text-danger' : 'text-warning')} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-700 text-text">{breach.rule}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{breach.target} · {breach.org}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn('text-xs font-800', breach.severity === 'high' ? 'text-danger' : 'text-warning')}>
                    Overdue by {breach.overdue}
                  </p>
                  <Badge variant={breach.severity === 'high' ? 'danger' : 'warning'} className="mt-1">{breach.severity}</Badge>
                </div>
                <button onClick={() => { setEscalating(breach); setNote(''); }}
                  className="px-3 py-1.5 bg-primary text-white text-xs font-700 rounded-lg hover:bg-primary-hover transition-colors shrink-0">
                  Escalate
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <TextInputModal
        open={!!escalating}
        onClose={() => setEscalating(null)}
        onConfirm={handleEscalate}
        loading={loading}
        title="Escalate Breach"
        label={`Escalation note — ${escalating?.target}`}
        placeholder="Describe the escalation action taken or required…"
        confirmLabel="Escalate"
        confirmVariant="danger"
        value={note}
        onChange={setNote}
      />
    </div>
  );
}
