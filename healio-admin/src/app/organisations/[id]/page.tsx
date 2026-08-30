'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Building2, MapPin, Users, UserCog, TrendingUp,
  CreditCard, Pencil, Check, X, ShieldCheck, Ban, Wallet,
  Star, AlertTriangle, Clock, Package, CalendarClock, Trash2,
  ChevronRight, Zap, Plus, Phone,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Toggle } from '@/components/ui/Toggle';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { cn, formatCurrency } from '@/lib/utils';
import { featureFlags } from '@/lib/mock-data';
import { orgApi, patientApi, providerApi, appointmentApi, orderApi, transactionApi, auditApi, staffApi } from '@/lib/api';
import type { OrgStaffMember } from '@/lib/actions';
import type { Organisation, Patient, Provider, Appointment, Order, Transaction } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────
const subBadge: Record<string, { variant: 'primary' | 'info' | 'warning'; label: string }> = {
  enterprise: { variant: 'primary', label: 'Enterprise' },
  growth:     { variant: 'info',    label: 'Growth'     },
  starter:    { variant: 'warning', label: 'Starter'    },
};

const TABS = ['Overview', 'Staff', 'Patients', 'Financial', 'Config', 'Danger Zone'] as const;
type Tab = typeof TABS[number];

// ── Staff management constants ─────────────────────────────────────────────────
const STAFF_ROLE_FILTERS = [
  { key: 'all',                  label: 'All'       },
  { key: 'doctor',               label: 'Doctors'   },
  { key: 'pharmacy_assistant',   label: 'Pharmacy'  },
  { key: 'lab_technician',       label: 'Lab'       },
  { key: 'homecare_assistant',   label: 'Homecare'  },
  { key: 'opd_assistant',        label: 'OPD'       },
  { key: 'nurse',                label: 'Nurses'    },
] as const;

const ROLE_LABELS: Record<string, string> = {
  doctor:               'Doctor',
  pharmacy_assistant:   'Pharmacy',
  lab_technician:       'Lab',
  homecare_assistant:   'Homecare',
  opd_assistant:        'OPD',
  nurse:                'Nurse',
  hospital_admin:       'Admin',
};

const emptyStaffForm = { name: '', role: 'doctor', phone: '', specialty: '', department: '' };

// ── Editable field ────────────────────────────────────────────────────────────
function Field({
  label, value, editing, editEl,
}: { label: string; value: string; editing: boolean; editEl?: React.ReactNode }) {
  return (
    <div className="bg-surface-2 rounded-xl p-3">
      <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider mb-1">{label}</p>
      {editing && editEl ? editEl : <p className="text-sm font-700 text-text capitalize">{value}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function OrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  // Real data for this org (fetched from Supabase)
  const [org, setOrg] = useState<Organisation | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgAppointments, setOrgAppointments] = useState<Appointment[]>([]);
  const [orgOrders, setOrgOrders] = useState<Order[]>([]);
  const [orgTransactions, setOrgTransactions] = useState<Transaction[]>([]);

  // Tab & edit state
  const [tab, setTab]       = useState<Tab>('Overview');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Organisation>>({});
  const [saving, setSaving]   = useState(false);

  // Modal state
  const [confirmModal, setConfirmModal] = useState<
    | { type: 'suspend' }
    | { type: 'activate' }
    | { type: 'delete' }
    | { type: 'verifyProvider'; provider: Provider }
    | { type: 'banPatient'; patient: Patient }
    | null
  >(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Local mutation state (the org's providers & patients)
  const [localProviders, setLocalProviders] = useState<Provider[]>([]);
  const [localPatients,  setLocalPatients]  = useState<Patient[]>([]);

  // Staff management state
  const [localStaff,      setLocalStaff]      = useState<OrgStaffMember[]>([]);
  const [staffLoading,    setStaffLoading]    = useState(false);
  const [staffRoleFilter, setStaffRoleFilter] = useState<string>('all');
  const [addStaffOpen,    setAddStaffOpen]    = useState(false);
  const [staffForm,       setStaffForm]       = useState(emptyStaffForm);
  const [addingStaff,     setAddingStaff]     = useState(false);
  const [addedCreds,      setAddedCreds]      = useState<(OrgStaffMember & { loginPhone: string }) | null>(null);
  const [staffError,      setStaffError]      = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [orgs, provs, pats, appts, ords, txns] = await Promise.all([
          orgApi.list(), providerApi.list(), patientApi.list(),
          appointmentApi.list(), orderApi.list(), transactionApi.list(),
        ]);
        const found = orgs.find(o => o.id === id) ?? null;
        setOrg(found);
        setLocalProviders(provs.filter(p => p.orgId === id));
        setLocalPatients(pats.filter(p => p.orgId === id));
        if (found) {
          setOrgAppointments(appts.filter(a => a.orgName === found.name));
          setOrgOrders(ords.filter(o => o.orgName === found.name));
          setOrgTransactions(txns.filter(t => t.orgName === found.name));
        }
      } catch (e) {
        console.error('Failed to load organisation detail:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Load org staff separately (dedicated endpoint for this org)
  useEffect(() => {
    setStaffLoading(true);
    staffApi.listByOrg(id)
      .then(setLocalStaff)
      .catch((e) => console.error('Failed to load org staff:', e))
      .finally(() => setStaffLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center animate-pulse">
          <span className="text-white font-800 text-lg">H</span>
        </div>
        <p className="text-xs text-text-muted">Loading organisation…</p>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Building2 className="w-10 h-10 text-border-strong" />
        <p className="text-sm font-600 text-text-secondary">Organisation not found</p>
        <button onClick={() => router.push('/organisations')}
          className="text-xs font-700 text-primary hover:underline">← Back to Organisations</button>
      </div>
    );
  }

  const sub = subBadge[org.subscription];
  const orgRevenue = orgTransactions.filter(t => t.status === 'completed').reduce((s, t) => s + t.amount, 0);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const startEdit = () => {
    setEditForm({
      name:         org.name,
      type:         org.type,
      city:         org.city,
      country:      org.country,
      subscription: org.subscription,
    });
    setEditMode(true);
  };

  const cancelEdit = () => { setEditMode(false); setEditForm({}); };

  const saveEdit = async () => {
    setSaving(true);
    // → await supabase.from('organisations').update(editForm).eq('id', id);
    await auditApi.log('Updated organisation', 'Organisations', org.name);
    setOrg(prev => prev ? { ...prev, ...editForm } : prev);
    setSaving(false);
    setEditMode(false);
  };

  const handleSuspend = async () => {
    setModalLoading(true);
    await orgApi.suspend(id);
    await auditApi.log('Suspended organisation', 'Organisations', org.name);
    setOrg(prev => prev ? { ...prev, status: 'suspended' } : prev);
    setModalLoading(false);
    setConfirmModal(null);
  };

  const handleActivate = async () => {
    setModalLoading(true);
    await orgApi.approve(id);
    await auditApi.log('Activated organisation', 'Organisations', org.name);
    setOrg(prev => prev ? { ...prev, status: 'active' } : prev);
    setModalLoading(false);
    setConfirmModal(null);
  };

  const handleDelete = async () => {
    setModalLoading(true);
    try {
      await orgApi.delete(id);
      await auditApi.log('Deleted organisation', 'Organisations', org.name);
      router.push('/organisations');
    } catch (e: any) {
      console.error('Delete failed:', e);
      alert(`Delete failed: ${e?.message ?? 'Unknown error'}`);
    } finally {
      setModalLoading(false);
      setConfirmModal(null);
    }
  };

  // ── Staff handlers ───────────────────────────────────────────────────────────
  const handleToggleStaff = async (member: OrgStaffMember) => {
    const next = member.status === 'active' ? 'inactive' : 'active';
    setLocalStaff(prev => prev.map(s => s.id === member.id ? { ...s, status: next } : s));
    try {
      await (next === 'active' ? staffApi.activate(member.id) : staffApi.deactivate(member.id));
      await auditApi.log(`${next === 'active' ? 'Activated' : 'Deactivated'} staff`, 'Organisations', member.name);
    } catch (e: any) {
      // Revert on failure
      setLocalStaff(prev => prev.map(s => s.id === member.id ? { ...s, status: member.status } : s));
      alert(`Failed: ${e?.message ?? 'Unknown error'}`);
    }
  };

  const handleAddStaff = async () => {
    setAddingStaff(true);
    setStaffError(null);
    try {
      const created = await staffApi.create({
        orgId: id,
        name: staffForm.name.trim(),
        role: staffForm.role,
        phone: staffForm.phone,
        specialty: staffForm.specialty.trim() || undefined,
        department: staffForm.department.trim() || undefined,
      });
      setLocalStaff(prev => [created, ...prev]);
      setAddedCreds(created);
      await auditApi.log('Added staff member', 'Organisations', `${created.name} (${created.role}) → ${org!.name}`);
    } catch (e: any) {
      setStaffError(e?.message ?? 'Failed to create staff member.');
    } finally {
      setAddingStaff(false);
    }
  };

  const handleVerifyProvider = async () => {
    if (confirmModal?.type !== 'verifyProvider') return;
    setModalLoading(true);
    await providerApi.verify(confirmModal.provider.id);
    await auditApi.log('Verified provider', 'Users', confirmModal.provider.name);
    setLocalProviders(prev => prev.map(p => p.id === confirmModal.provider.id
      ? { ...p, status: 'active', verifiedAt: new Date().toISOString() } : p));
    setModalLoading(false);
    setConfirmModal(null);
  };

  const handleBanPatient = async () => {
    if (confirmModal?.type !== 'banPatient') return;
    setModalLoading(true);
    const isBanned = confirmModal.patient.status === 'banned';
    await patientApi[isBanned ? 'unban' : 'ban'](confirmModal.patient.id);
    await auditApi.log(isBanned ? 'Unbanned patient' : 'Banned patient', 'Users', confirmModal.patient.name);
    setLocalPatients(prev => prev.map(p => p.id === confirmModal.patient.id
      ? { ...p, status: isBanned ? 'active' : 'banned' } : p));
    setModalLoading(false);
    setConfirmModal(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Breadcrumb + back */}
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <button onClick={() => router.push('/organisations')} className="flex items-center gap-1 hover:text-primary transition-colors font-600">
          <ArrowLeft className="w-3.5 h-3.5" />Organisations
        </button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-text font-700">{org.name}</span>
      </div>

      {/* Header card */}
      <Card padding="none">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary-soft flex items-center justify-center shrink-0">
                <span className="text-primary text-xl font-800">{org.name[0]}</span>
              </div>
              <div>
                {editMode ? (
                  <input
                    value={editForm.name ?? ''}
                    onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                    className="text-xl font-800 text-text bg-surface-2 border border-primary rounded-lg px-2 py-0.5 focus:outline-none w-72"
                  />
                ) : (
                  <h1 className="text-xl font-800 text-text">{org.name}</h1>
                )}
                <div className="flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3 h-3 text-text-muted" />
                  {editMode ? (
                    <div className="flex items-center gap-2">
                      <input value={editForm.city ?? ''} onChange={(e) => setEditForm(f => ({ ...f, city: e.target.value }))}
                        placeholder="City"
                        className="text-xs text-text bg-surface-2 border border-border rounded px-2 py-0.5 focus:outline-none w-28 focus:border-primary" />
                      <input value={editForm.country ?? ''} onChange={(e) => setEditForm(f => ({ ...f, country: e.target.value }))}
                        placeholder="Country"
                        className="text-xs text-text bg-surface-2 border border-border rounded px-2 py-0.5 focus:outline-none w-16 focus:border-primary" />
                    </div>
                  ) : (
                    <span className="text-xs text-text-secondary">{org.city}, {org.country}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant={org.status === 'active' ? 'success' : org.status === 'suspended' ? 'danger' : org.status === 'trial' ? 'warning' : 'muted'} dot>
                    {org.status}
                  </Badge>
                  {editMode ? (
                    <select value={editForm.subscription ?? org.subscription}
                      onChange={(e) => setEditForm(f => ({ ...f, subscription: e.target.value as Organisation['subscription'] }))}
                      className="text-xs bg-surface-2 border border-border rounded px-2 py-0.5 focus:outline-none focus:border-primary">
                      <option value="starter">Starter</option>
                      <option value="growth">Growth</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  ) : (
                    <Badge variant={sub.variant}>{sub.label}</Badge>
                  )}
                  {editMode ? (
                    <select value={editForm.type ?? org.type}
                      onChange={(e) => setEditForm(f => ({ ...f, type: e.target.value as Organisation['type'] }))}
                      className="text-xs bg-surface-2 border border-border rounded px-2 py-0.5 focus:outline-none focus:border-primary">
                      <option value="hospital">Hospital</option>
                      <option value="clinic">Clinic</option>
                      <option value="diagnostic">Diagnostic</option>
                      <option value="pharmacy">Pharmacy</option>
                    </select>
                  ) : (
                    <Badge variant="muted" className="capitalize">{org.type}</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Edit / Save controls */}
            <div className="flex items-center gap-2 shrink-0">
              {editMode ? (
                <>
                  <button onClick={cancelEdit}
                    className="flex items-center gap-1.5 px-3 py-2 border border-border text-xs font-700 text-text-secondary rounded-lg hover:bg-surface-2 transition-colors">
                    <X className="w-3.5 h-3.5" />Cancel
                  </button>
                  <button onClick={saveEdit} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-700 rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-60">
                    <Check className="w-3.5 h-3.5" />{saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <button onClick={startEdit}
                  className="flex items-center gap-1.5 px-3 py-2 border border-border text-xs font-700 text-text rounded-lg hover:bg-surface-2 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />Edit
                </button>
              )}
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6 pt-5 border-t border-border">
            {[
              { icon: UserCog,      color: 'text-primary',  bg: 'bg-primary-soft',  label: 'Providers',      value: org.providerCount },
              { icon: Users,        color: 'text-info',     bg: 'bg-info-soft',     label: 'Patients',       value: org.patientCount.toLocaleString() },
              { icon: CalendarClock,color: 'text-warning',  bg: 'bg-warning-soft',  label: 'Appointments',   value: orgAppointments.length },
              { icon: Package,      color: 'text-success',  bg: 'bg-success-soft',  label: 'Orders',         value: orgOrders.length },
              { icon: TrendingUp,   color: 'text-success',  bg: 'bg-success-soft',  label: 'MRR',            value: formatCurrency(org.mrr) },
            ].map(({ icon: Icon, color, bg, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', bg)}>
                  <Icon className={cn('w-4 h-4', color)} />
                </div>
                <div>
                  <p className="text-sm font-800 text-text">{value}</p>
                  <p className="text-[10px] text-text-muted font-600">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center border-t border-border overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                'px-5 py-3 text-xs font-700 whitespace-nowrap border-b-2 transition-colors',
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text hover:border-border',
                t === 'Danger Zone' && tab !== t && 'text-danger/60 hover:text-danger',
                t === 'Danger Zone' && tab === t && 'border-danger text-danger',
              )}>
              {t}
            </button>
          ))}
        </div>
      </Card>

      {/* ── OVERVIEW TAB ──────────────────────────────────────────────────────── */}
      {tab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card padding="lg">
            <CardHeader><CardTitle>Organisation Details</CardTitle></CardHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name" value={org.name} editing={editMode}
                editEl={<input value={editForm.name ?? ''} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-2 py-1 bg-surface border border-primary rounded text-xs text-text focus:outline-none" />} />
              <Field label="Type" value={org.type} editing={editMode}
                editEl={<select value={editForm.type ?? org.type} onChange={(e) => setEditForm(f => ({ ...f, type: e.target.value as Organisation['type'] }))}
                  className="w-full px-2 py-1 bg-surface border border-primary rounded text-xs text-text focus:outline-none">
                  <option value="hospital">Hospital</option><option value="clinic">Clinic</option>
                  <option value="diagnostic">Diagnostic</option><option value="pharmacy">Pharmacy</option>
                </select>} />
              <Field label="City" value={org.city} editing={editMode}
                editEl={<input value={editForm.city ?? ''} onChange={(e) => setEditForm(f => ({ ...f, city: e.target.value }))}
                  className="w-full px-2 py-1 bg-surface border border-primary rounded text-xs text-text focus:outline-none" />} />
              <Field label="Country" value={org.country} editing={editMode}
                editEl={<input value={editForm.country ?? ''} onChange={(e) => setEditForm(f => ({ ...f, country: e.target.value }))}
                  className="w-full px-2 py-1 bg-surface border border-primary rounded text-xs text-text focus:outline-none" />} />
              <Field label="Admin Phone" value={org.phone || '—'} editing={false} />
              <Field label="Admin Email" value={org.email || '—'} editing={false} />
              <Field label="Address" value={org.address || '—'} editing={false} />
              <Field label="Beds" value={org.beds || '—'} editing={false} />
              <Field label="Status" value={org.status} editing={false} />
              <Field label="Joined" value={new Date(org.joinedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} editing={false} />
            </div>
          </Card>

          <Card padding="lg">
            <CardHeader><CardTitle>Subscription</CardTitle></CardHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {(['starter', 'growth', 'enterprise'] as Organisation['subscription'][]).map(plan => (
                  <button key={plan} disabled={!editMode}
                    onClick={() => editMode && setEditForm(f => ({ ...f, subscription: plan }))}
                    className={cn(
                      'p-3 rounded-xl border-2 text-left transition-all',
                      (editMode ? (editForm.subscription ?? org.subscription) : org.subscription) === plan
                        ? 'border-primary bg-primary-soft'
                        : 'border-border bg-surface-2',
                      editMode ? 'cursor-pointer hover:border-primary/50' : 'cursor-default',
                    )}>
                    <p className="text-xs font-800 text-text capitalize">{plan}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      {plan === 'starter' ? 'Up to 5 providers' : plan === 'growth' ? 'Up to 25 providers' : 'Unlimited'}
                    </p>
                  </button>
                ))}
              </div>
              <div className="bg-surface-2 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-700 text-text">Monthly Recurring Revenue</span>
                  <span className="text-base font-800 text-primary">{formatCurrency(org.mrr)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-secondary">Total revenue tracked</span>
                  <span className="text-xs font-700 text-text">{formatCurrency(orgRevenue)}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card padding="lg" className="lg:col-span-2">
            <CardHeader><CardTitle>Activity Summary</CardTitle></CardHeader>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Scheduled Appointments', value: orgAppointments.filter(a => a.status === 'scheduled').length, color: 'text-warning' },
                { label: 'Completed Appointments', value: orgAppointments.filter(a => a.status === 'completed').length, color: 'text-success' },
                { label: 'Active Patients', value: localPatients.filter(p => p.status === 'active').length, color: 'text-info' },
                { label: 'Pending Verification', value: localProviders.filter(p => p.status === 'pending_verification').length, color: 'text-warning' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-surface-2 rounded-xl p-4 text-center">
                  <p className={cn('text-2xl font-800', color)}>{value}</p>
                  <p className="text-[11px] text-text-muted mt-1 leading-snug">{label}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── STAFF TAB ─────────────────────────────────────────────────────────── */}
      {tab === 'Staff' && (() => {
        const filteredStaff = staffRoleFilter === 'all'
          ? localStaff
          : localStaff.filter(s => s.role === staffRoleFilter);
        return (
          <div className="space-y-4">
            <Card padding="none">
              {/* Header: role filter + add button */}
              <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-800 text-text">{localStaff.length} Staff</span>
                  <div className="flex items-center gap-0.5 bg-surface-2 rounded-lg p-0.5 border border-border flex-wrap">
                    {STAFF_ROLE_FILTERS.map(r => (
                      <button key={r.key} onClick={() => setStaffRoleFilter(r.key)}
                        className={cn(
                          'px-2.5 py-1 text-[10px] font-700 rounded-md transition-colors whitespace-nowrap',
                          staffRoleFilter === r.key ? 'bg-primary text-white' : 'text-text-secondary hover:text-text',
                        )}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => { setStaffForm(emptyStaffForm); setAddedCreds(null); setStaffError(null); setAddStaffOpen(true); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-700 rounded-lg hover:bg-primary-hover transition-colors shrink-0">
                  <Plus className="w-3.5 h-3.5" /> Add Staff
                </button>
              </div>

              {staffLoading ? (
                <div className="py-14 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredStaff.length === 0 ? (
                <div className="py-16 text-center">
                  <UserCog className="w-8 h-8 text-border-strong mx-auto mb-2" />
                  <p className="text-sm text-text-muted">
                    {staffRoleFilter === 'all' ? 'No staff in this organisation' : `No ${ROLE_LABELS[staffRoleFilter] ?? staffRoleFilter} staff`}
                  </p>
                  <button
                    onClick={() => { setStaffForm({ ...emptyStaffForm, role: staffRoleFilter === 'all' ? 'doctor' : staffRoleFilter }); setAddedCreds(null); setStaffError(null); setAddStaffOpen(true); }}
                    className="mt-2 text-xs font-700 text-primary hover:underline">
                    + Add first staff member
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-text-muted font-600 border-b border-border bg-surface-2">
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3">Specialty / Dept</th>
                        <th className="px-4 py-3">Joined</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredStaff.map(s => (
                        <tr key={s.id} className="hover:bg-surface-2 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={s.name} size="sm" />
                              <p className="font-700 text-text">{s.name}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="muted">{ROLE_LABELS[s.role] ?? s.role}</Badge>
                          </td>
                          <td className="px-4 py-3 font-mono text-[10px] text-text-secondary">{s.phone || '—'}</td>
                          <td className="px-4 py-3 text-text-secondary">
                            {s.specialty || s.department || '—'}
                          </td>
                          <td className="px-4 py-3 text-text-muted">
                            {new Date(s.joinedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={s.status === 'active' ? 'success' : 'muted'} dot>
                              {s.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleToggleStaff(s)}
                              className={cn(
                                'p-1.5 rounded-md transition-colors',
                                s.status === 'active'
                                  ? 'hover:bg-warning-soft text-warning'
                                  : 'hover:bg-success-soft text-success',
                              )}
                              title={s.status === 'active' ? 'Deactivate' : 'Reactivate'}>
                              {s.status === 'active'
                                ? <Ban className="w-3.5 h-3.5" />
                                : <Check className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* ── Add Staff Modal ──────────────────────────────────────────── */}
            <Modal
              open={addStaffOpen}
              onClose={() => { setAddStaffOpen(false); setAddedCreds(null); setStaffError(null); }}
              title="Add Staff Member"
              size="md"
              footer={
                addedCreds ? (
                  <button
                    onClick={() => { setAddStaffOpen(false); setAddedCreds(null); setStaffError(null); }}
                    className="px-4 py-2 text-xs font-700 text-white bg-success rounded-lg hover:bg-success/90 transition-colors">
                    Done
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => { setAddStaffOpen(false); setStaffError(null); }}
                      className="px-4 py-2 text-xs font-700 text-text-secondary border border-border rounded-lg hover:text-text transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={handleAddStaff}
                      disabled={addingStaff || !staffForm.name.trim() || staffForm.phone.length !== 10}
                      className="px-4 py-2 text-xs font-700 text-white bg-primary rounded-lg hover:bg-primary-hover disabled:opacity-60 transition-colors">
                      {addingStaff ? 'Creating account…' : 'Create Staff Account'}
                    </button>
                  </>
                )
              }>

              {addedCreds ? (
                /* Success screen — show login credentials */
                <div className="space-y-4">
                  <div className="bg-success-soft rounded-xl p-4 flex items-start gap-3">
                    <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-800 text-success">Staff account created!</p>
                      <p className="text-xs text-text-secondary mt-0.5">Share these login credentials with the staff member.</p>
                    </div>
                  </div>
                  <div className="bg-surface-2 rounded-xl p-4 space-y-3 border border-border">
                    <div>
                      <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider mb-1">Name</p>
                      <p className="text-sm font-700 text-text">{addedCreds.name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider mb-1">Role</p>
                      <p className="text-sm font-700 text-text">{ROLE_LABELS[addedCreds.role] ?? addedCreds.role}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-primary" />
                      <div>
                        <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider mb-0.5">Login Phone</p>
                        <p className="text-sm font-800 text-primary font-mono">{addedCreds.loginPhone}</p>
                      </div>
                    </div>
                    <div className="bg-warning-soft rounded-lg p-3">
                      <p className="text-[10px] font-700 text-warning uppercase tracking-wider mb-1">Temporary Password</p>
                      <p className="text-sm font-800 text-text font-mono">Healio-Dev-1234</p>
                      <p className="text-[10px] text-text-muted mt-1">The staff member can change their password after first login in the Provider app.</p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Add staff form */
                <div className="space-y-4">
                  {staffError && (
                    <div className="bg-danger-soft rounded-xl p-3 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-danger shrink-0 mt-0.5" />
                      <p className="text-xs text-danger">{staffError}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-700 text-text mb-1.5">Full Name *</label>
                    <input
                      type="text"
                      value={staffForm.name}
                      onChange={(e) => setStaffForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Dr. Rajesh Kumar"
                      className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-700 text-text mb-1.5">Role *</label>
                      <select
                        value={staffForm.role}
                        onChange={(e) => setStaffForm(f => ({ ...f, role: e.target.value }))}
                        className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary">
                        <option value="doctor">Doctor</option>
                        <option value="pharmacy_assistant">Pharmacy Assistant</option>
                        <option value="lab_technician">Lab Technician</option>
                        <option value="homecare_assistant">Homecare Assistant</option>
                        <option value="opd_assistant">OPD Assistant</option>
                        <option value="nurse">Nurse</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-700 text-text mb-1.5">Phone * <span className="font-500 text-text-muted">(10 digits)</span></label>
                      <div className="flex">
                        <span className="inline-flex items-center px-2 bg-surface-2 border border-border border-r-0 rounded-l-lg text-[10px] text-text-muted font-600">+91</span>
                        <input
                          type="tel"
                          value={staffForm.phone}
                          onChange={(e) => setStaffForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                          placeholder="9876543210"
                          maxLength={10}
                          className="flex-1 px-2 py-2 bg-surface-2 border border-border rounded-r-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary"
                        />
                      </div>
                      {staffForm.phone.length > 0 && staffForm.phone.length < 10 && (
                        <p className="mt-0.5 text-[10px] text-danger">{10 - staffForm.phone.length} more digits</p>
                      )}
                    </div>
                  </div>
                  {staffForm.role === 'doctor' && (
                    <div>
                      <label className="block text-xs font-700 text-text mb-1.5">Specialty</label>
                      <input
                        type="text"
                        value={staffForm.specialty}
                        onChange={(e) => setStaffForm(f => ({ ...f, specialty: e.target.value }))}
                        placeholder="e.g. Cardiologist, General Physician"
                        className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-700 text-text mb-1.5">Department</label>
                    <input
                      type="text"
                      value={staffForm.department}
                      onChange={(e) => setStaffForm(f => ({ ...f, department: e.target.value }))}
                      placeholder="e.g. Cardiology, Pharmacy, Radiology"
                      className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="bg-surface-2 rounded-xl p-3 border border-border">
                    <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider mb-1">Login access</p>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      A Healio Provider account will be created using the phone number. The staff member logs in with their phone number and OTP (or password) in the Healio Provider app.
                    </p>
                  </div>
                </div>
              )}
            </Modal>
          </div>
        );
      })()}

      {/* ── PATIENTS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'Patients' && (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <CardTitle>{localPatients.length} Patients</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="success">{localPatients.filter(p => p.status === 'active').length} active</Badge>
              {localPatients.filter(p => p.status === 'banned').length > 0 && (
                <Badge variant="danger">{localPatients.filter(p => p.status === 'banned').length} banned</Badge>
              )}
            </div>
          </div>
          {localPatients.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="w-8 h-8 text-border-strong mx-auto mb-2" />
              <p className="text-sm text-text-muted">No patients in this organisation</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-text-muted font-600 border-b border-border bg-surface-2">
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Wallet</th>
                    <th className="px-4 py-3">Appointments</th>
                    <th className="px-4 py-3">Last Active</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {localPatients.map(p => (
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
                      <td className="px-4 py-3 font-mono text-[10px] text-text-secondary">{p.phone}</td>
                      <td className="px-4 py-3 font-700 text-text">{formatCurrency(p.walletBalance)}</td>
                      <td className="px-4 py-3 text-text-secondary">{p.appointmentCount}</td>
                      <td className="px-4 py-3 text-text-muted">{new Date(p.lastActiveAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                      <td className="px-4 py-3">
                        <Badge variant={p.status === 'active' ? 'success' : p.status === 'banned' ? 'danger' : 'muted'} dot>{p.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setConfirmModal({ type: 'banPatient', patient: p })}
                          className={cn(
                            'p-1.5 rounded-md transition-colors',
                            p.status === 'banned' ? 'hover:bg-success-soft text-success' : 'hover:bg-danger-soft text-danger',
                          )}
                          title={p.status === 'banned' ? 'Unban' : 'Ban'}>
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── FINANCIAL TAB ────────────────────────────────────────────────────── */}
      {tab === 'Financial' && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Revenue',    value: formatCurrency(orgRevenue),                                           color: 'text-success', bg: 'bg-success-soft', icon: TrendingUp },
              { label: 'MRR',              value: formatCurrency(org.mrr),                                              color: 'text-primary', bg: 'bg-primary-soft', icon: CreditCard },
              { label: 'Wallet Balance',   value: formatCurrency(localPatients.reduce((s, p) => s + p.walletBalance, 0)), color: 'text-info',    bg: 'bg-info-soft',    icon: Wallet    },
              { label: 'Transactions',     value: String(orgTransactions.length),                                       color: 'text-warning', bg: 'bg-warning-soft', icon: CreditCard },
            ].map(({ label, value, color, bg, icon: Icon }) => (
              <Card key={label} padding="sm">
                <div className="flex items-center gap-3">
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', bg)}>
                    <Icon className={cn('w-4 h-4', color)} />
                  </div>
                  <div>
                    <p className="text-base font-800 text-text">{value}</p>
                    <p className="text-[10px] text-text-secondary font-600">{label}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Transaction list */}
          <Card padding="none">
            <div className="px-5 py-4 border-b border-border">
              <CardTitle>Recent Transactions</CardTitle>
            </div>
            {orgTransactions.length === 0 ? (
              <div className="py-12 text-center text-sm text-text-muted">No transactions yet</div>
            ) : (
              <div className="divide-y divide-border">
                {orgTransactions.map(t => (
                  <div key={t.id} className="flex items-center gap-4 px-5 py-3">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      t.type === 'topup' ? 'bg-success-soft' : t.type === 'refund' ? 'bg-info-soft' : t.type === 'subscription' ? 'bg-primary-soft' : 'bg-surface-3',
                    )}>
                      <CreditCard className={cn('w-4 h-4', t.type === 'topup' ? 'text-success' : t.type === 'refund' ? 'text-info' : t.type === 'subscription' ? 'text-primary' : 'text-text-muted')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-700 text-text capitalize">{t.type}</p>
                      <p className="text-[10px] text-text-muted">{t.userName} · {t.method}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-xs font-800', t.status === 'completed' ? 'text-text' : 'text-text-muted')}>
                        {formatCurrency(t.amount)}
                      </p>
                      <Badge variant={t.status === 'completed' ? 'success' : t.status === 'failed' ? 'danger' : 'warning'}>{t.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Patient wallets */}
          <Card padding="none">
            <div className="px-5 py-4 border-b border-border">
              <CardTitle>Patient Wallets</CardTitle>
            </div>
            <div className="divide-y divide-border">
              {localPatients.map(p => (
                <div key={p.id} className="flex items-center gap-4 px-5 py-3">
                  <Avatar name={p.name} size="sm" />
                  <div className="flex-1">
                    <p className="text-xs font-700 text-text">{p.name}</p>
                    <p className="text-[10px] text-text-muted">{p.appointmentCount} appointments</p>
                  </div>
                  <span className={cn('text-xs font-800', p.walletBalance > 0 ? 'text-text' : 'text-text-muted')}>
                    {formatCurrency(p.walletBalance)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── CONFIG TAB ───────────────────────────────────────────────────────── */}
      {tab === 'Config' && (
        <div className="space-y-5">
          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle>Feature Flag Overrides</CardTitle>
                <p className="text-xs text-text-secondary mt-0.5">Override global feature flags for this organisation only</p>
              </div>
            </CardHeader>
            <div className="space-y-2">
              {featureFlags.map(flag => {
                const override = flag.orgOverrides.find(ov => ov.orgId === id);
                const effectiveState = override ? override.enabled : flag.enabled;
                return (
                  <div key={flag.id} className="flex items-center gap-4 py-3 border-b border-border last:border-0">
                    <div className={cn('w-2 h-2 rounded-full shrink-0', effectiveState ? 'bg-success' : 'bg-danger')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-700 text-text">{flag.name}</p>
                        {override && (
                          <Badge variant="warning">org override</Badge>
                        )}
                        <Badge variant={flag.app === 'patient' ? 'info' : flag.app === 'provider' ? 'primary' : 'muted'}>
                          {flag.app === 'both' ? 'Both' : flag.app}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-text-muted mt-0.5">{flag.description}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] text-text-muted">
                        {override ? 'Overridden' : `Global: ${flag.enabled ? 'ON' : 'OFF'}`}
                      </span>
                      <Toggle checked={effectiveState} onChange={() => {}} size="sm" />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle>Notification Preferences</CardTitle>
                <p className="text-xs text-text-secondary mt-0.5">Communication settings for this organisation</p>
              </div>
            </CardHeader>
            <div className="space-y-4">
              {[
                { label: 'Appointment reminders', desc: 'Send SMS/push reminders to patients', enabled: true },
                { label: 'Billing notifications', desc: 'Invoice and payment alerts', enabled: true },
                { label: 'System alerts', desc: 'Critical platform alerts to org admin', enabled: true },
                { label: 'Marketing emails', desc: 'Promotional content and updates', enabled: false },
              ].map(({ label, desc, enabled }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-xs font-700 text-text">{label}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">{desc}</p>
                  </div>
                  <Toggle checked={enabled} onChange={() => {}} size="sm" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── DANGER ZONE TAB ──────────────────────────────────────────────────── */}
      {tab === 'Danger Zone' && (
        <div className="space-y-4">
          <Card padding="lg" className="border-warning/30">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-warning-soft flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-warning" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-800 text-text mb-1">
                  {org.status === 'suspended' ? 'Reactivate Organisation' : 'Suspend Organisation'}
                </p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {org.status === 'suspended'
                    ? 'Reactivating will restore full access for all users in this organisation immediately.'
                    : 'Suspending will lock out all providers and patients in this organisation immediately. They will see a "platform suspended" message.'
                  }
                </p>
              </div>
              <button
                onClick={() => setConfirmModal({ type: org.status === 'suspended' ? 'activate' : 'suspend' })}
                className={cn(
                  'px-4 py-2 text-xs font-700 rounded-lg transition-colors shrink-0',
                  org.status === 'suspended'
                    ? 'bg-success text-white hover:bg-success/90'
                    : 'bg-warning-soft text-warning border border-warning/30 hover:bg-warning/10',
                )}>
                {org.status === 'suspended' ? 'Reactivate' : 'Suspend'}
              </button>
            </div>
          </Card>

          <Card padding="lg" className="border-danger/30">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-danger-soft flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-danger" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-800 text-text mb-1">Delete Organisation</p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Permanently delete this organisation and all associated data — providers, patients, appointments, orders, and financial records. <strong>This cannot be undone.</strong>
                </p>
              </div>
              <button onClick={() => setConfirmModal({ type: 'delete' })}
                className="px-4 py-2 text-xs font-700 bg-danger text-white rounded-lg hover:bg-danger/90 transition-colors shrink-0">
                Delete
              </button>
            </div>
          </Card>

          <Card padding="lg" className="border-info/20">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-info-soft flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-info" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-800 text-text mb-1">Downgrade Plan</p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Move this organisation to a lower subscription tier. Any features beyond the new plan limit will be disabled at the next billing cycle.
                </p>
              </div>
              <button onClick={() => { setTab('Overview'); setEditMode(true); }}
                className="px-4 py-2 text-xs font-700 border border-border text-text rounded-lg hover:bg-surface-2 transition-colors shrink-0">
                Change Plan
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Confirm modals ────────────────────────────────────────────────────── */}
      <ConfirmModal
        open={confirmModal?.type === 'suspend'}
        onClose={() => setConfirmModal(null)}
        onConfirm={handleSuspend}
        loading={modalLoading}
        title="Suspend Organisation"
        message={`Suspend ${org.name}? All ${localProviders.length} providers and ${localPatients.length} patients will lose access immediately.`}
        confirmLabel="Suspend"
        confirmVariant="danger"
      />
      <ConfirmModal
        open={confirmModal?.type === 'activate'}
        onClose={() => setConfirmModal(null)}
        onConfirm={handleActivate}
        loading={modalLoading}
        title="Reactivate Organisation"
        message={`Reactivate ${org.name}? All users will regain full platform access.`}
        confirmLabel="Reactivate"
        confirmVariant="success"
      />
      <ConfirmModal
        open={confirmModal?.type === 'delete'}
        onClose={() => setConfirmModal(null)}
        onConfirm={handleDelete}
        loading={modalLoading}
        title="Delete Organisation"
        message={`Permanently delete ${org.name} and all its data? This includes ${localProviders.length} providers, ${localPatients.length} patients, and all financial records. This cannot be undone.`}
        confirmLabel="Delete Permanently"
        confirmVariant="danger"
      />
      <ConfirmModal
        open={confirmModal?.type === 'verifyProvider'}
        onClose={() => setConfirmModal(null)}
        onConfirm={handleVerifyProvider}
        loading={modalLoading}
        title="Verify Provider"
        message={confirmModal?.type === 'verifyProvider' ? `Verify ${confirmModal.provider.name}? They will become active and visible to patients in ${org.name}.` : ''}
        confirmLabel="Verify & Activate"
        confirmVariant="success"
      />
      <ConfirmModal
        open={confirmModal?.type === 'banPatient'}
        onClose={() => setConfirmModal(null)}
        onConfirm={handleBanPatient}
        loading={modalLoading}
        title={confirmModal?.type === 'banPatient' && confirmModal.patient.status === 'banned' ? 'Unban Patient' : 'Ban Patient'}
        message={
          confirmModal?.type === 'banPatient'
            ? confirmModal.patient.status === 'banned'
              ? `Unban ${confirmModal.patient.name}? They will regain access.`
              : `Ban ${confirmModal.patient.name}? They will be locked out immediately.`
            : ''
        }
        confirmLabel={confirmModal?.type === 'banPatient' && confirmModal.patient.status === 'banned' ? 'Unban' : 'Ban'}
        confirmVariant={confirmModal?.type === 'banPatient' && confirmModal.patient.status === 'banned' ? 'success' : 'danger'}
      />
    </div>
  );
}
