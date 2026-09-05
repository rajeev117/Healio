'use client';
import { useState, useEffect } from 'react';
import {
  Building2, Search, Plus, MapPin, Users, UserCog, TrendingUp, ExternalLink, MoreHorizontal,
} from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { cn, formatCurrency } from '@/lib/utils';
import { orgApi, auditApi } from '@/lib/api';
import type { Organisation } from '@/types';
import { isValidOrgName, isValidPhone } from '@/lib/validation';

const STATUS_FILTERS = ['All', 'Active', 'Trial', 'Suspended', 'Pending'] as const;
const TYPE_FILTERS = ['All', 'Hospital', 'Clinic', 'Diagnostic', 'Pharmacy'] as const;

const subBadge: Record<string, { variant: 'primary' | 'info' | 'warning'; label: string }> = {
  enterprise: { variant: 'primary', label: 'Enterprise' },
  growth: { variant: 'info', label: 'Growth' },
  starter: { variant: 'warning', label: 'Starter' },
};

type ModalState =
  | { type: 'suspend'; org: Organisation }
  | { type: 'activate'; org: Organisation }
  | { type: 'create' }
  | null;

const emptyForm = {
  name: '', type: 'clinic' as Organisation['type'], city: '', country: 'IN',
  subscription: 'starter' as Organisation['subscription'],
  phone: '',
};

function OrgCard({ org, onView, onMenu }: { org: Organisation; onView: () => void; onMenu: () => void }) {
  const sub = subBadge[org.subscription];
  return (
    <Card padding="none" className="hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 group animate-scale-in">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar name={org.name} size="lg" className="bg-primary text-white" />
            <div>
              <h3 className="text-sm font-800 text-text group-hover:text-primary transition-colors">{org.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3 h-3 text-text-muted" />
                <span className="text-[11px] text-text-secondary">{org.city}, {org.country}</span>
              </div>
              {org.phone && (
                <p className="text-[11px] text-text-muted mt-0.5 font-mono">{org.phone}</p>
              )}
            </div>
          </div>
          <button onClick={onMenu} className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted" title="Options">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Badge variant={org.status === 'active' ? 'success' : org.status === 'trial' ? 'warning' : org.status === 'suspended' ? 'danger' : 'muted'} dot>
            {org.status}
          </Badge>
          <Badge variant={sub.variant}>{sub.label}</Badge>
          <Badge variant="muted" className="capitalize">{org.type}</Badge>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface-2 rounded-lg p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1"><UserCog className="w-3 h-3 text-primary" /></div>
            <p className="text-sm font-800 text-text">{org.providerCount}</p>
            <p className="text-[10px] text-text-muted font-600">Providers</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1"><Users className="w-3 h-3 text-info" /></div>
            <p className="text-sm font-800 text-text">{org.patientCount.toLocaleString()}</p>
            <p className="text-[10px] text-text-muted font-600">Patients</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1"><TrendingUp className="w-3 h-3 text-success" /></div>
            <p className="text-sm font-800 text-text">{formatCurrency(org.mrr)}</p>
            <p className="text-[10px] text-text-muted font-600">MRR</p>
          </div>
        </div>
      </div>

      <div className="border-t border-border px-4 py-2.5 flex items-center justify-between bg-surface-2">
        <span className="text-[10px] text-text-muted">Joined {new Date(org.joinedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        <Link href={`/organisations/${org.id}`} className="flex items-center gap-1 text-[10px] font-700 text-primary hover:underline">
          View details <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </Card>
  );
}

export default function OrganisationsPage() {
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [fetching, setFetching] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    orgApi.list()
      .then(setOrgs)
      .catch((e) => console.error('Failed to load organisations:', e))
      .finally(() => setFetching(false));
  }, []);

  const filtered = orgs.filter((org) => {
    if (statusFilter !== 'All' && org.status !== statusFilter.toLowerCase()) return false;
    if (typeFilter !== 'All' && org.type !== typeFilter.toLowerCase()) return false;
    if (search && !org.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalMRR = orgs.reduce((sum, o) => sum + o.mrr, 0);
  const totalPatients = orgs.reduce((sum, o) => sum + o.patientCount, 0);

  // The phone becomes the provider's login credential, so it has to be a real
  // Indian mobile number — not merely ten characters.
  const formValid =
    isValidOrgName(form.name) && !!form.city.trim() && isValidPhone(form.phone);

  const handleCreate = async () => {
    if (!formValid) return;
    setLoading(true);
    try {
      const newOrg = await orgApi.create({
        name: form.name.trim(),
        type: form.type,
        city: form.city.trim(),
        country: form.country || 'IN',
        subscription: form.subscription,
        phone: `+91${form.phone.trim()}`,
      });
      await auditApi.log('Created organisation', 'Organisations', newOrg.name);
      setOrgs(prev => [newOrg, ...prev]);
      setForm(emptyForm);
      setModal(null);
    } catch (e) {
      console.error('Failed to create organisation:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (modal?.type !== 'suspend') return;
    setLoading(true);
    await orgApi.suspend(modal.org.id);
    await auditApi.log('Suspended organisation', 'Organisations', modal.org.name);
    setOrgs(prev => prev.map(o => o.id === modal.org.id ? { ...o, status: 'suspended' } : o));
    setLoading(false);
    setModal(null);
  };

  const handleActivate = async () => {
    if (modal?.type !== 'activate') return;
    setLoading(true);
    await orgApi.approve(modal.org.id);
    await auditApi.log('Activated organisation', 'Organisations', modal.org.name);
    setOrgs(prev => prev.map(o => o.id === modal.org.id ? { ...o, status: 'active' } : o));
    setLoading(false);
    setModal(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-800 text-text">Organisations</h1>
          <p className="text-sm text-text-secondary mt-0.5">{fetching ? 'Loading…' : `${orgs.length} tenants on the platform`}</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setModal({ type: 'create' }); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-700 rounded-lg hover:bg-primary-hover transition-colors">
          <Plus className="w-3.5 h-3.5" />Add Organisation
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Orgs', value: orgs.length, icon: Building2, color: 'text-primary', bg: 'bg-primary-soft' },
          { label: 'Active', value: orgs.filter(o => o.status === 'active').length, icon: Building2, color: 'text-success', bg: 'bg-success-soft' },
          { label: 'Total Patients', value: totalPatients.toLocaleString(), icon: Users, color: 'text-info', bg: 'bg-info-soft' },
          { label: 'Platform MRR', value: formatCurrency(totalMRR), icon: TrendingUp, color: 'text-success', bg: 'bg-success-soft' },
        ].map((stat) => (
          <Card key={stat.label} padding="sm">
            <div className="flex items-center gap-3">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', stat.bg)}>
                <stat.icon className={cn('w-4 h-4', stat.color)} />
              </div>
              <div>
                <p className="text-lg font-800 text-text">{stat.value}</p>
                <p className="text-[10px] text-text-secondary font-600">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center bg-surface rounded-lg border border-border p-0.5">
          {STATUS_FILTERS.map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={cn('px-3 py-1.5 rounded-md text-xs font-700 transition-colors', statusFilter === f ? 'bg-primary text-white' : 'text-text-secondary hover:text-text')}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center bg-surface rounded-lg border border-border p-0.5">
          {TYPE_FILTERS.map((f) => (
            <button key={f} onClick={() => setTypeFilter(f)}
              className={cn('px-3 py-1.5 rounded-md text-xs font-700 transition-colors', typeFilter === f ? 'bg-primary text-white' : 'text-text-secondary hover:text-text')}>
              {f}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input type="text" placeholder="Search organisations..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 w-full bg-surface border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((org) => (
          <OrgCard key={org.id} org={org}
            onView={() => {}}
            onMenu={() => setModal(org.status === 'suspended' ? { type: 'activate', org } : { type: 'suspend', org })}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <Building2 className="w-10 h-10 text-border-strong mx-auto mb-3" />
            <p className="text-sm text-text-secondary font-600">No organisations match your filters</p>
          </div>
        )}
      </div>

      {/* Create org modal */}
      <Modal open={modal?.type === 'create'} onClose={() => setModal(null)} title="Add Organisation" size="md"
        footer={
          <>
            <button onClick={() => setModal(null)} className="px-4 py-2 text-xs font-700 text-text-secondary border border-border rounded-lg hover:text-text transition-colors">Cancel</button>
            <button onClick={handleCreate} disabled={loading || !formValid}
              className="px-4 py-2 text-xs font-700 text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-60">
              {loading ? 'Creating…' : 'Add Organisation'}
            </button>
          </>
        }>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-700 text-text mb-1.5">Organisation Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. City Hospital Dhaka"
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-700 text-text mb-1.5">Type</label>
              <select value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value as Organisation['type'] }))}
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary">
                <option value="hospital">Hospital</option>
                <option value="clinic">Clinic</option>
                <option value="diagnostic">Diagnostic</option>
                <option value="pharmacy">Pharmacy</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-700 text-text mb-1.5">Subscription</label>
              <select value={form.subscription} onChange={(e) => setForm(f => ({ ...f, subscription: e.target.value as Organisation['subscription'] }))}
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary">
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-700 text-text mb-1.5">City *</label>
              <input type="text" value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="e.g. Delhi"
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-700 text-text mb-1.5">Country</label>
              <input type="text" value={form.country} onChange={(e) => setForm(f => ({ ...f, country: e.target.value }))}
                placeholder="IN"
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-700 text-text mb-1.5">
              Admin Phone * <span className="text-text-muted font-500 normal-case">(10-digit mobile number)</span>
            </label>
            <div className="flex">
              <span className="inline-flex items-center px-3 py-2 bg-surface-2 border border-border border-r-0 rounded-l-lg text-xs text-text-muted font-600">+91</span>
              <input type="tel" value={form.phone}
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                placeholder="9876543210" maxLength={10}
                className="flex-1 px-3 py-2 bg-surface-2 border border-border rounded-r-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
            </div>
            {form.phone.length > 0 && form.phone.length < 10 && (
              <p className="mt-1 text-[10px] text-danger font-600">{10 - form.phone.length} more digits needed</p>
            )}
          </div>
          <div className="bg-surface-2 rounded-xl p-3 border border-border">
            <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider mb-1">Note</p>
            <p className="text-xs text-text-secondary">Organisation will be created with <strong>Pending</strong> status and placed in the Onboarding Queue for review.</p>
          </div>
        </div>
      </Modal>


      <ConfirmModal
        open={modal?.type === 'suspend'}
        onClose={() => setModal(null)}
        onConfirm={handleSuspend}
        loading={loading}
        title="Suspend Organisation"
        message={modal?.type === 'suspend' ? `Suspend ${modal.org.name}? All their users will lose platform access immediately.` : ''}
        confirmLabel="Suspend"
        confirmVariant="danger"
      />

      <ConfirmModal
        open={modal?.type === 'activate'}
        onClose={() => setModal(null)}
        onConfirm={handleActivate}
        loading={loading}
        title="Activate Organisation"
        message={modal?.type === 'activate' ? `Reactivate ${modal.org.name}? Their users will regain full platform access.` : ''}
        confirmLabel="Activate"
        confirmVariant="success"
      />
    </div>
  );
}
