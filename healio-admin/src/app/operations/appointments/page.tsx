'use client';
import { useState, useEffect, useRef } from 'react';
import { Eye, Video, Check, X, PlayCircle, Bell } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { cn, formatCurrency } from '@/lib/utils';
import { appointmentApi, auditApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { Appointment } from '@/types';

// ─── Status display config ────────────────────────────────────────────────────
// scheduled   → patient booked, waiting for provider to accept
// in_progress → provider accepted, appointment is active / happening now
// completed   → appointment done
// cancelled   → cancelled by either party
const STATUS_TABS = ['All', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'] as const;

const STATUS_LABEL: Record<string, string> = {
  scheduled:   'Pending Acceptance',
  in_progress: 'Accepted / Active',
  completed:   'Completed',
  cancelled:   'Cancelled',
};

const statusBadge: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'muted'> = {
  scheduled:   'warning',
  in_progress: 'info',
  completed:   'success',
  cancelled:   'danger',
};

// What the admin can do at each status:
//   scheduled   → Accept (moves to in_progress) | Cancel
//   in_progress → Mark Complete (moves to completed) | Cancel
//   completed   → view only
//   cancelled   → view only
type ModalState =
  | { type: 'view';     apt: Appointment }
  | { type: 'accept';   apt: Appointment }   // scheduled → in_progress
  | { type: 'complete'; apt: Appointment }   // in_progress → completed
  | { type: 'cancel';   apt: Appointment }
  | null;

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [fetching, setFetching] = useState(true);
  const [tab, setTab] = useState('All');
  const [modal, setModal] = useState<ModalState>(null);
  const [loading, setLoading] = useState(false);
  const [liveBanner, setLiveBanner] = useState<string | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    appointmentApi.list()
      .then(setAppointments)
      .catch((e) => console.error('Failed to load appointments:', e))
      .finally(() => setFetching(false));
  }, []);

  // Live notifications — new bookings and status changes
  useEffect(() => {
    const showBanner = (msg: string) => {
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      setLiveBanner(msg);
      bannerTimer.current = setTimeout(() => setLiveBanner(null), 5000);
    };

    const channel = supabase
      .channel('admin-appointments-live')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'appointments' },
        () => {
          showBanner('New appointment booked by a patient');
          appointmentApi.list().then(setAppointments).catch(() => {});
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'appointments' },
        (payload) => {
          const n = payload.new as { status: string };
          const o = payload.old as { status: string };
          if (n.status === 'cancelled' && o.status !== 'cancelled') {
            showBanner('An appointment was cancelled');
          }
          appointmentApi.list().then(setAppointments).catch(() => {});
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = appointments.filter(a =>
    tab === 'All' || a.status === tab.toLowerCase().replace(' ', '_')
  );
  const liveCount    = appointments.filter(a => a.status === 'in_progress').length;
  const pendingCount = appointments.filter(a => a.status === 'scheduled').length;

  // Accept: scheduled → in_progress
  const handleAccept = async () => {
    if (modal?.type !== 'accept') return;
    setLoading(true);
    await appointmentApi.confirm(modal.apt.id);
    await auditApi.log('Accepted appointment', 'Operations', `${modal.apt.patientName} → ${modal.apt.providerName}`);
    setAppointments(prev => prev.map(a => a.id === modal.apt.id ? { ...a, status: 'in_progress' } : a));
    setLoading(false);
    setModal(null);
  };

  // Complete: in_progress → completed
  const handleComplete = async () => {
    if (modal?.type !== 'complete') return;
    setLoading(true);
    // Reuse the same API endpoint — just marking it completed
    await appointmentApi.complete?.(modal.apt.id) ?? await appointmentApi.confirm(modal.apt.id);
    await auditApi.log('Completed appointment', 'Operations', `${modal.apt.patientName} → ${modal.apt.providerName}`);
    setAppointments(prev => prev.map(a => a.id === modal.apt.id ? { ...a, status: 'completed' } : a));
    setLoading(false);
    setModal(null);
  };

  // Cancel: any active status → cancelled
  const handleCancel = async () => {
    if (modal?.type !== 'cancel') return;
    setLoading(true);
    await appointmentApi.cancel(modal.apt.id);
    await auditApi.log('Cancelled appointment', 'Operations', `${modal.apt.patientName} → ${modal.apt.providerName}`);
    setAppointments(prev => prev.map(a => a.id === modal.apt.id ? { ...a, status: 'cancelled' } : a));
    setLoading(false);
    setModal(null);
  };

  return (
    <div className="space-y-5">
      {/* Live notification banner */}
      {liveBanner && (
        <div className="flex items-center gap-3 bg-primary text-white px-4 py-3 rounded-xl text-sm font-700 animate-pulse-once">
          <Bell className="w-4 h-4 shrink-0" />
          <span className="flex-1">{liveBanner}</span>
          <button onClick={() => setLiveBanner(null)} className="opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-800 text-text">Appointments</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Accept incoming bookings, track live sessions, and manage the queue.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <Card padding="sm" className="text-center">
            <p className="text-lg font-800 text-text">{appointments.length}</p>
            <p className="text-[10px] text-text-muted font-600">Total</p>
          </Card>
          <Card padding="sm" className="text-center">
            <p className="text-lg font-800 text-warning">{pendingCount}</p>
            <p className="text-[10px] text-text-muted font-600">Pending</p>
          </Card>
          <Card padding="sm" className="text-center">
            <div className="flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <p className="text-lg font-800 text-success">{liveCount}</p>
            </div>
            <p className="text-[10px] text-text-muted font-600">Active now</p>
          </Card>
          <Card padding="sm" className="text-center">
            <p className="text-lg font-800 text-text">{formatCurrency(appointments.reduce((s, a) => s + a.fee, 0))}</p>
            <p className="text-[10px] text-text-muted font-600">Revenue</p>
          </Card>
        </div>
      </div>

      {/* Status flow explanation banner */}
      <div className="flex items-center gap-2 text-[11px] text-text-secondary bg-surface-2 border border-border rounded-lg px-4 py-2.5 w-fit">
        <span className="font-700 text-text">Workflow:</span>
        <span className="px-2 py-0.5 bg-warning-soft text-warning rounded font-700">Pending</span>
        <span>→ Admin accepts →</span>
        <span className="px-2 py-0.5 bg-info-soft text-info rounded font-700">Active</span>
        <span>→ Admin marks done →</span>
        <span className="px-2 py-0.5 bg-success-soft text-success rounded font-700">Completed</span>
      </div>

      {/* Tab filter */}
      <div className="flex items-center bg-surface rounded-lg border border-border p-0.5 w-fit">
        {STATUS_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-3 py-1.5 rounded-md text-xs font-700 transition-colors',
              tab === t ? 'bg-primary text-white' : 'text-text-secondary hover:text-text')}>
            {t}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-text-muted font-600 border-b border-border bg-surface-2">
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Organisation</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Fee</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {fetching ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-text-muted">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-text-muted">No appointments found.</td></tr>
              ) : filtered.map(apt => (
                <tr key={apt.id} className={cn(
                  'hover:bg-surface-2 transition-colors',
                  apt.status === 'in_progress' && 'bg-info-soft/30',
                  apt.status === 'scheduled'   && 'bg-warning-soft/20',
                )}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={apt.patientName} size="sm" />
                      <span className="font-700 text-text">{apt.patientName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-600 text-text">{apt.providerName}</td>
                  <td className="px-4 py-3 text-text-secondary">{apt.orgName}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {apt.type === 'video' && <Video className="w-3 h-3 text-info" />}
                      <span className="capitalize text-text-secondary">{apt.type}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {new Date(apt.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 font-700 text-text">{formatCurrency(apt.fee)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusBadge[apt.status] || 'muted'} dot>
                      {STATUS_LABEL[apt.status] || apt.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      {/* View details */}
                      <button onClick={() => setModal({ type: 'view', apt })}
                        className="p-1.5 rounded-md hover:bg-surface-3 text-text-muted" title="View details">
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* Accept — only for scheduled (pending) appointments */}
                      {apt.status === 'scheduled' && (
                        <>
                          <button onClick={() => setModal({ type: 'accept', apt })}
                            className="p-1.5 rounded-md hover:bg-success-soft text-success" title="Accept booking">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setModal({ type: 'cancel', apt })}
                            className="p-1.5 rounded-md hover:bg-danger-soft text-danger" title="Cancel">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      {/* Mark complete — only for in_progress appointments */}
                      {apt.status === 'in_progress' && (
                        <>
                          <button onClick={() => setModal({ type: 'complete', apt })}
                            className="p-1.5 rounded-md hover:bg-success-soft text-success" title="Mark as completed">
                            <PlayCircle className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setModal({ type: 'cancel', apt })}
                            className="p-1.5 rounded-md hover:bg-danger-soft text-danger" title="Cancel">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* View appointment details modal */}
      <Modal open={modal?.type === 'view'} onClose={() => setModal(null)} title="Appointment Details">
        {modal?.type === 'view' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Patient',       value: modal.apt.patientName },
                { label: 'Provider',      value: modal.apt.providerName },
                { label: 'Organisation',  value: modal.apt.orgName },
                { label: 'Type',          value: modal.apt.type },
                { label: 'Scheduled At',  value: new Date(modal.apt.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) },
                { label: 'Fee',           value: formatCurrency(modal.apt.fee) },
                { label: 'Status',        value: STATUS_LABEL[modal.apt.status] || modal.apt.status },
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

      {/* Accept booking modal */}
      <ConfirmModal
        open={modal?.type === 'accept'}
        onClose={() => setModal(null)}
        onConfirm={handleAccept}
        loading={loading}
        title="Accept Booking"
        message={modal?.type === 'accept'
          ? `Accept the appointment request from ${modal.apt.patientName} with ${modal.apt.providerName}? This confirms the slot and notifies the patient.`
          : ''}
        confirmLabel="Accept Booking"
        confirmVariant="success"
      />

      {/* Mark complete modal */}
      <ConfirmModal
        open={modal?.type === 'complete'}
        onClose={() => setModal(null)}
        onConfirm={handleComplete}
        loading={loading}
        title="Mark as Completed"
        message={modal?.type === 'complete'
          ? `Mark the appointment for ${modal.apt.patientName} with ${modal.apt.providerName} as completed?`
          : ''}
        confirmLabel="Mark Completed"
        confirmVariant="success"
      />

      {/* Cancel modal */}
      <ConfirmModal
        open={modal?.type === 'cancel'}
        onClose={() => setModal(null)}
        onConfirm={handleCancel}
        loading={loading}
        title="Cancel Appointment"
        message={modal?.type === 'cancel'
          ? `Cancel the appointment for ${modal.apt.patientName} with ${modal.apt.providerName}? This cannot be undone.`
          : ''}
        confirmLabel="Cancel Appointment"
        confirmVariant="danger"
      />
    </div>
  );
}
