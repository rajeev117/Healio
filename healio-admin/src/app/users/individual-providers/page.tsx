'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Stethoscope, FlaskConical, Pill, Search, ExternalLink, ShieldOff, ShieldCheck,
  AlertTriangle, MapPin, Phone, Mail, FileText, Users, CalendarClock, Package,
  type LucideIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Toggle } from '@/components/ui/Toggle';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { individualProviderApi, featureApi } from '@/lib/api';
import type { IndividualProvider, IndividualProviderDetail, Feature } from '@/lib/actions';
import { INDIVIDUAL_KINDS, KIND_MASTER_FEATURE, type IndividualKind } from '@/lib/platform-meta';

// ─────────────────────────────────────────────────────────────────────────────
// Independent Providers — solo doctors, standalone labs, standalone pharmacies.
//
// Naming: the mobile app's roles are independent_doctor / independent_lab /
// independent_pharmacy. The admin panel used to say "Individual Doctor" but
// "Independent Lab", and the sidebar said "Individual Providers" while its own
// rows said "Independent". One word now, matching the code.
//
// These are ORGANISATIONS, not staff — each is its own tenant (org type
// clinic / diagnostic / pharmacy) whose admin is the practitioner. That is why
// "Details" opens an organisation, and why the sibling page is called
// Organisation Staff rather than Providers.
// ─────────────────────────────────────────────────────────────────────────────

const KIND_ICON: Record<IndividualKind, LucideIcon> = {
  individual_doctor: Stethoscope,
  independent_lab: FlaskConical,
  independent_pharmacy: Pill,
};

const KIND_ORDER: IndividualKind[] = [
  'individual_doctor', 'independent_lab', 'independent_pharmacy',
];

function StatusBadge({ status }: { status: IndividualProvider['status'] }) {
  if (status === 'suspended') return <Badge variant="danger" dot>Suspended</Badge>;
  if (status === 'pending') return <Badge variant="warning" dot>Pending approval</Badge>;
  if (status === 'trial') return <Badge variant="warning" dot>Trial</Badge>;
  return <Badge variant="success" dot>Active</Badge>;
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="bg-surface-2 rounded-xl p-3 text-center">
      <Icon className="w-4 h-4 text-primary mx-auto mb-1" />
      <p className="text-base font-800 text-text">{value.toLocaleString()}</p>
      <p className="text-[10px] text-text-muted font-600">{label}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider">{label}</p>
      <div className="text-xs text-text mt-0.5 break-words">{value || '—'}</div>
    </div>
  );
}

export default function IndependentProvidersPage() {
  const [providers, setProviders] = useState<IndividualProvider[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<IndividualKind>('individual_doctor');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ provider: IndividualProvider } | null>(null);
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState<IndividualProviderDetail | null>(null);
  const [detailFor, setDetailFor] = useState<IndividualProvider | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      individualProviderApi.list(),
      featureApi.list().catch(() => [] as Feature[]),
    ])
      .then(([list, feats]) => {
        if (cancelled) return;
        setProviders(list);
        setFeatures(feats);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('Failed to load independent providers:', e);
        setError(e?.message ?? 'Could not load providers.');
      })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, []);

  const masterOff = (k: IndividualKind) => {
    const f = features.find((x) => x.key === KIND_MASTER_FEATURE[k]);
    return f ? !f.enabled : false;
  };

  const countsByKind = useMemo(() => {
    const m = new Map<IndividualKind, { active: number; total: number }>();
    KIND_ORDER.forEach((k) => m.set(k, { active: 0, total: 0 }));
    providers.forEach((p) => {
      const c = m.get(p.kind) ?? { active: 0, total: 0 };
      c.total += 1;
      if (p.status === 'active') c.active += 1;
      m.set(p.kind, c);
    });
    return m;
  }, [providers]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return providers
      .filter((p) => p.kind === kind)
      .filter((p) => !q
        || p.name.toLowerCase().includes(q)
        || p.city.toLowerCase().includes(q)
        || (p.phone ?? '').includes(q)
        || (p.email ?? '').toLowerCase().includes(q));
  }, [providers, kind, search]);

  const openDetail = async (p: IndividualProvider) => {
    setDetailFor(p);
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await individualProviderApi.detail(p.id));
    } catch (e) {
      console.error('Failed to load provider detail:', e);
    } finally {
      setDetailLoading(false);
    }
  };

  const onToggle = async (provider: IndividualProvider, enable: boolean) => {
    if (!enable) { setReason(''); setConfirm({ provider }); return; }
    await apply(provider, true);
  };

  const apply = async (provider: IndividualProvider, enable: boolean, why?: string) => {
    setBusyId(provider.id);
    setProviders((prev) => prev.map((p) => (p.id === provider.id
      ? { ...p, status: enable ? 'active' : 'suspended', suspendedReason: enable ? null : (why ?? null) }
      : p)));
    try {
      if (enable) await individualProviderApi.enable(provider.id);
      else await individualProviderApi.disable(provider.id, why);
    } catch (e) {
      console.error('Failed to change provider status:', e);
      setProviders((prev) => prev.map((p) => (p.id === provider.id ? provider : p)));
      setError(e instanceof Error ? e.message : 'Could not change status.');
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  };

  const meta = INDIVIDUAL_KINDS[kind];
  const KindIcon = KIND_ICON[kind];
  const kindCount = countsByKind.get(kind) ?? { active: 0, total: 0 };
  const activeTotal = providers.filter((p) => p.status === 'active').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-800 text-text">Independent Providers</h1>
          <p className="text-sm text-text-secondary mt-0.5 max-w-2xl">
            Practitioners who are their own business — each is a tenant in its own
            right, not a member of someone else&apos;s staff. People employed by an
            organisation are under{' '}
            <Link href="/users/providers" className="text-primary hover:underline">
              Organisation Staff
            </Link>.
          </p>
        </div>
        {!fetching && (
          <div className="flex items-center gap-2">
            <Badge variant="success" dot>{activeTotal} active</Badge>
            <Badge variant="danger" dot>{providers.length - activeTotal} off</Badge>
          </div>
        )}
      </div>

      {/* Kind sections */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center overflow-x-auto">
          {KIND_ORDER.map((k) => {
            const m = INDIVIDUAL_KINDS[k];
            const Icon = KIND_ICON[k];
            const c = countsByKind.get(k) ?? { active: 0, total: 0 };
            const active = kind === k;
            return (
              <button key={k} onClick={() => setKind(k)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-xs font-700 whitespace-nowrap border-b-2 transition-colors shrink-0',
                  active
                    ? 'border-primary text-primary bg-primary-soft/40'
                    : 'border-transparent text-text-secondary hover:text-text hover:border-border',
                )}>
                <Icon className="w-4 h-4" />
                {m.plural}
                <span className={cn('text-[10px] font-800 px-1.5 py-0.5 rounded-full',
                  active ? 'bg-primary text-white' : 'bg-surface-3 text-text-secondary')}>
                  {c.active}/{c.total}
                </span>
                {masterOff(k) && <AlertTriangle className="w-3.5 h-3.5 text-warning" />}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Selected kind */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-4 py-3.5 bg-surface-2 border-b border-border flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-9 h-9 rounded-lg bg-primary-soft flex items-center justify-center shrink-0">
              <KindIcon className="w-4 h-4 text-primary" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-800 text-text">{meta.plural}</h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Organisations of type <code className="font-mono">{meta.orgType}</code>
              </p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, city, phone…"
              className="w-56 pl-8 pr-2 py-1.5 rounded-lg border border-border bg-surface text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
          </div>
        </div>

        {masterOff(kind) && (
          <div className="flex items-start gap-2 px-4 py-2.5 bg-warning-soft border-b border-border">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-warning font-600">
              The <strong>{meta.plural}</strong> master switch is OFF in Features, so
              none of these are reachable in the patient app regardless of the
              individual switches below.
            </p>
          </div>
        )}

        {fetching ? (
          <p className="text-sm text-text-muted text-center py-10">Loading providers…</p>
        ) : error ? (
          <p className="text-sm text-danger text-center py-10">{error}</p>
        ) : visible.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-10 px-4">
            {kindCount.total === 0
              ? `No ${meta.plural.toLowerCase()} yet. They appear here once an application of type "${meta.orgType}" is approved in the Onboarding Queue.`
              : 'None match that search.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-700 text-text-muted">{meta.label}</th>
                  <th className="px-4 py-3 font-700 text-text-muted">Contact</th>
                  <th className="px-4 py-3 font-700 text-text-muted text-center">Staff</th>
                  <th className="px-4 py-3 font-700 text-text-muted">Status</th>
                  <th className="px-4 py-3 font-700 text-text-muted text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={p.name} size="sm" />
                        <div className="min-w-0">
                          <p className="font-700 text-text truncate">{p.name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-text-muted">
                            {p.city && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{p.city}</span>}
                            {!p.linked && <Badge variant="muted">Never logged in</Badge>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.phone && <p className="font-mono text-text-secondary">{p.phone}</p>}
                      {p.email && <p className="text-[10px] text-text-muted truncate">{p.email}</p>}
                      {!p.phone && !p.email && <span className="text-text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center font-700 text-text">{p.staffCount}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                      {p.status === 'suspended' && p.suspendedReason && (
                        <p className="text-[10px] text-danger mt-0.5">{p.suspendedReason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openDetail(p)}
                          className="px-2.5 py-1 rounded-md border border-border text-[11px] font-700 text-text-secondary hover:bg-surface-2 transition-colors">
                          Details
                        </button>
                        <Toggle
                          checked={p.status === 'active'}
                          disabled={busyId === p.id || p.status === 'pending'}
                          onChange={(next) => onToggle(p, next)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Detail */}
      <Modal
        open={!!detailFor}
        onClose={() => { setDetailFor(null); setDetail(null); }}
        title={detailFor?.name ?? ''}
        size="lg"
      >
        {detailLoading && <p className="text-sm text-text-muted text-center py-8">Loading details…</p>}
        {!detailLoading && detail?.provider && detailFor && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <Avatar name={detail.provider.name} size="xl" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-800 text-text">{detail.provider.name}</h3>
                  <StatusBadge status={detail.provider.status} />
                  <Badge variant="muted">{detail.provider.kindLabel}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-2 flex-wrap text-[11px] text-text-secondary">
                  {detail.provider.phone && <span className="inline-flex items-center gap-1 font-mono"><Phone className="w-3 h-3" />{detail.provider.phone}</span>}
                  {detail.provider.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{detail.provider.email}</span>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Stat icon={CalendarClock} label="Appointments" value={detail.counts.appointments} />
              <Stat icon={Package} label="Orders" value={detail.counts.orders} />
              <Stat icon={Users} label="Patients" value={detail.counts.patients} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-surface-2">
              <Field label="City" value={detail.provider.city} />
              <Field label="Subscription" value={detail.subscription ? <span className="capitalize">{detail.subscription}</span> : '—'} />
              <Field label="Joined" value={detail.provider.joinedAt
                ? new Date(detail.provider.joinedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                : '—'} />
              <Field label="Has logged in" value={detail.provider.linked ? 'Yes' : 'No — account not claimed'} />
              <Field label="Address" value={detail.address} />
              <Field label="Map location" value={detail.latitude != null && detail.longitude != null ? (
                <a href={`https://www.google.com/maps/search/?api=1&query=${detail.latitude},${detail.longitude}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline">
                  {detail.latitude.toFixed(4)}, {detail.longitude.toFixed(4)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : 'Not set — will not appear in "nearest" results'} />
            </div>

            {/* Verification documents */}
            <div>
              <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider mb-2">
                Verification Documents
              </p>
              {detail.docs.length === 0 ? (
                <p className="text-xs text-text-muted">No documents on file.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {detail.docs.map((d) => (
                    <div key={d.label} className={cn('flex items-center gap-2 p-2.5 rounded-lg border',
                      d.url ? 'border-border bg-surface-2' : 'border-warning/40 bg-warning-soft')}>
                      {d.url ? <FileText className="w-4 h-4 text-primary shrink-0" />
                             : <AlertTriangle className="w-4 h-4 text-warning shrink-0" />}
                      <span className="text-xs font-700 text-text flex-1 truncate">{d.label}</span>
                      {d.url ? (
                        <a href={d.url} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] font-700 text-primary hover:underline inline-flex items-center gap-1">
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : <span className="text-[11px] text-warning font-600">Missing</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Their own staff */}
            <div>
              <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider mb-2">
                Staff ({detail.staff.length})
              </p>
              {detail.staff.length === 0 ? (
                <p className="text-xs text-text-muted">
                  No staff — a one-person practice.
                </p>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  {detail.staff.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border last:border-0">
                      <div className="min-w-0">
                        <p className="text-xs font-700 text-text truncate">{m.name}</p>
                        <p className="text-[10px] text-text-muted capitalize">{m.role.replace(/_/g, ' ')}</p>
                      </div>
                      <span className="text-[10px] font-mono text-text-secondary">{m.phone}</span>
                      <Badge variant={m.status === 'active' ? 'success' : 'muted'}>{m.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Link href={`/organisations/${detail.provider.id}`}
              className="inline-flex items-center gap-1 text-xs font-700 text-primary hover:underline">
              Open full organisation record <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        )}
      </Modal>

      {/* Disable confirmation */}
      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm ? `Turn off ${confirm.provider.name}?` : ''}
      >
        {confirm && (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-danger-soft">
              <ShieldOff className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <div className="text-xs text-danger">
                <p className="font-700">This takes effect immediately.</p>
                <ul className="mt-1.5 space-y-1 list-disc list-inside">
                  <li>They cannot log in — an active session is signed out on next launch.</li>
                  <li>Their {confirm.provider.staffCount} staff account(s) are deactivated too.</li>
                  <li>They disappear from patient search and can take no new bookings.</li>
                </ul>
                <p className="mt-1.5">Existing records are kept. You can turn them back on at any time.</p>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-700 text-text-muted uppercase tracking-wider mb-1.5">
                Reason (optional — shown in the audit log)
              </label>
              <input value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. licence expired, pending re-verification"
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-700 text-text-secondary hover:bg-surface-2 transition-colors">
                Cancel
              </button>
              <button onClick={() => apply(confirm.provider, false, reason.trim() || undefined)}
                disabled={busyId === confirm.provider.id}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-danger text-white text-sm font-700 hover:opacity-90 transition-opacity disabled:opacity-60">
                <ShieldCheck className="w-4 h-4" />
                {busyId === confirm.provider.id ? 'Turning off…' : 'Turn off'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
