'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search, ShieldCheck, ExternalLink, Star, Phone, Mail, Building2,
  Stethoscope, FlaskConical, Pill, HeartPulse, ClipboardList, UserCog, Shield,
  ChevronLeft, ChevronRight, X,
  type LucideIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { providerApi, auditApi } from '@/lib/api';
import type { Provider, StaffRole } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Organisation Staff — every person who works inside an organisation.
//
// Everything that narrows the list happens in Postgres, not the browser. The
// previous version fetched every staff row on the platform and filtered in
// JavaScript, which is fine for one hospital and unusable at a thousand: the
// page would download the entire staff table to render twenty rows, and the
// search box only ever searched what had already been shipped.
//
// Rows are grouped under their organisation, so a page covering several
// hospitals reads as a set of rosters rather than a flat wall of names. Pick a
// single organisation from the filter to see just that one.
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_META: Record<StaffRole, { label: string; icon: LucideIcon }> = {
  doctor:             { label: 'Doctor',             icon: Stethoscope },
  lab_technician:     { label: 'Lab Technician',     icon: FlaskConical },
  pharmacy_assistant: { label: 'Pharmacy Assistant', icon: Pill },
  nurse:              { label: 'Nurse',              icon: HeartPulse },
  opd_assistant:      { label: 'OPD Assistant',      icon: ClipboardList },
  receptionist:       { label: 'Receptionist',       icon: UserCog },
  admin:              { label: 'Org Admin',          icon: Shield },
};

const ROLE_ORDER: StaffRole[] = [
  'doctor', 'lab_technician', 'pharmacy_assistant',
  'nurse', 'opd_assistant', 'receptionist', 'admin',
];

type StatusFilter = 'all' | 'active' | 'pending_verification' | 'suspended';
type OrgOption = { id: string; name: string; type: string; staffCount: number };
type ModalState =
  | { type: 'view'; provider: Provider }
  | { type: 'verify'; provider: Provider }
  | null;

function StatusBadge({ p }: { p: Provider }) {
  if (p.status === 'pending_verification') return <Badge variant="warning" dot>Unverified</Badge>;
  if (p.status === 'suspended') return <Badge variant="danger" dot>Suspended</Badge>;
  return <Badge variant="success" dot>Active</Badge>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider">{label}</p>
      <div className="text-xs text-text mt-0.5 break-words">{value || '—'}</div>
    </div>
  );
}

export default function OrganisationStaffPage() {
  const [rows, setRows] = useState<Provider[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [roleFilter, setRoleFilter] = useState<StaffRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [org, setOrg] = useState<OrgOption | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [modal, setModal] = useState<ModalState>(null);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Org picker
  const [orgPickerOpen, setOrgPickerOpen] = useState(false);
  const [orgQuery, setOrgQuery] = useState('');
  const [orgResults, setOrgResults] = useState<OrgOption[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);

  // Don't fire a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Any filter change starts again from page 1 — otherwise you land on page 7
  // of a result set that now has two pages and see nothing. Done in the
  // handlers rather than an effect so there is no second render pass.
  const changeSearch = (v: string) => { setSearch(v); setPage(1); };
  const changeRole = (v: StaffRole | 'all') => { setRoleFilter(v); setPage(1); };
  const changeStatus = (v: StatusFilter) => { setStatusFilter(v); setPage(1); };
  const changeOrg = (v: OrgOption | null) => { setOrg(v); setPage(1); };

  useEffect(() => {
    let cancelled = false;
    providerApi.page({
      page, pageSize,
      role: roleFilter,
      status: statusFilter,
      orgId: org?.id,
      search: debounced,
    })
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setTotal(res.total);
        setCounts(res.countsByRole);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('Failed to load staff:', e);
        setError(e?.message ?? 'Could not load staff.');
      })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [page, pageSize, roleFilter, statusFilter, org, debounced, reloadKey]);

  // Organisation search, also server-side.
  const loadOrgs = useCallback((q: string) => {
    let cancelled = false;
    providerApi.searchOrgs(q, 30)
      .then((r) => { if (!cancelled) { setOrgResults(r); setOrgLoading(false); } })
      .catch(() => { if (!cancelled) { setOrgResults([]); setOrgLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const orgPickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!orgPickerOpen) return undefined;
    return loadOrgs(orgQuery);
  }, [orgPickerOpen, orgQuery, loadOrgs]);

  useEffect(() => {
    if (!orgPickerOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!orgPickerRef.current?.contains(e.target as Node)) setOrgPickerOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [orgPickerOpen]);

  // Group the current page by organisation. Only meaningful when the list spans
  // more than one — a single-org view is already a roster.
  const grouped = useMemo(() => {
    const m = new Map<string, { name: string; orgId: string; staff: Provider[] }>();
    rows.forEach((p) => {
      const key = p.orgId || 'none';
      const g = m.get(key) ?? { name: p.orgName, orgId: p.orgId, staff: [] };
      g.staff.push(p);
      m.set(key, g);
    });
    return [...m.values()];
  }, [rows]);

  const handleVerify = async () => {
    if (modal?.type !== 'verify') return;
    setLoading(true);
    try {
      await providerApi.verify(modal.provider.id);
      await auditApi.log('Verified staff member', 'Users', modal.provider.name);
      setModal(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      console.error('Failed to verify:', e);
      setError(e instanceof Error ? e.message : 'Could not verify.');
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstOnPage = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastOnPage = Math.min(page * pageSize, total);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-800 text-text">Organisation Staff</h1>
          <p className="text-sm text-text-secondary mt-0.5 max-w-2xl">
            Everyone who works inside an organisation — doctors, nurses, lab and
            pharmacy staff, OPD assistants and org admins. Providers who are their
            own business live under{' '}
            <Link href="/users/individual-providers" className="text-primary hover:underline">
              Independent Providers
            </Link>.
          </p>
        </div>
        {!fetching && (
          <Badge variant="muted" dot>{total.toLocaleString()} matching</Badge>
        )}
      </div>

      {/* Role tabs */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center overflow-x-auto">
          {([['all', 'All'] as const, ...ROLE_ORDER.map((r) => [r, ROLE_META[r].label] as const)]).map(([value, label]) => {
            const active = roleFilter === value;
            const Icon = value === 'all' ? null : ROLE_META[value as StaffRole].icon;
            const n = counts[value] ?? 0;
            return (
              <button key={value} onClick={() => changeRole(value as StaffRole | 'all')}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-xs font-700 whitespace-nowrap border-b-2 transition-colors shrink-0',
                  active
                    ? 'border-primary text-primary bg-primary-soft/40'
                    : 'border-transparent text-text-secondary hover:text-text hover:border-border',
                )}>
                {Icon && <Icon className="w-4 h-4" />}
                {label}
                <span className={cn('text-[10px] font-800 px-1.5 py-0.5 rounded-full',
                  active ? 'bg-primary text-white' : 'bg-surface-3 text-text-secondary')}>
                  {n.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text" placeholder="Search name, staff ID, phone or specialty…"
            value={search} onChange={(e) => changeSearch(e.target.value)}
            className="pl-9 pr-3 py-2 w-full bg-surface border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary"
          />
        </div>

        {/* Organisation picker — searched server-side so it works at any scale */}
        <div className="relative" ref={orgPickerRef}>
          <button
            onClick={() => { setOrgPickerOpen((v) => !v); setOrgQuery(''); setOrgLoading(true); }}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-700 transition-colors',
              org ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface text-text-secondary hover:text-text',
            )}
          >
            <Building2 className="w-3.5 h-3.5" />
            {org ? org.name : 'All organisations'}
            {org && (
              <X className="w-3.5 h-3.5 hover:opacity-70"
                onClick={(e) => { e.stopPropagation(); changeOrg(null); setOrgPickerOpen(false); }} />
            )}
          </button>

          {orgPickerOpen && (
            <div className="absolute z-20 mt-1 w-72 rounded-xl border border-border bg-surface shadow-lg overflow-hidden">
              <div className="p-2 border-b border-border">
                <input
                  autoFocus value={orgQuery} onChange={(e) => setOrgQuery(e.target.value)}
                  placeholder="Search organisations…"
                  className="w-full px-2.5 py-1.5 rounded-md border border-border bg-surface-2 text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary"
                />
              </div>
              <div className="max-h-64 overflow-y-auto">
                <button onClick={() => { changeOrg(null); setOrgPickerOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs font-700 text-text-secondary hover:bg-surface-2">
                  All organisations
                </button>
                {orgLoading && <p className="px-3 py-3 text-xs text-text-muted">Searching…</p>}
                {!orgLoading && orgResults.length === 0 && (
                  <p className="px-3 py-3 text-xs text-text-muted">No organisations found.</p>
                )}
                {orgResults.map((o) => (
                  <button key={o.id} onClick={() => { changeOrg(o); setOrgPickerOpen(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-surface-2 flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block text-xs font-700 text-text truncate">{o.name}</span>
                      <span className="block text-[10px] text-text-muted capitalize">{o.type}</span>
                    </span>
                    <Badge variant="muted">{o.staffCount}</Badge>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center bg-surface rounded-lg border border-border p-0.5">
          {([['all', 'All'], ['active', 'Active'], ['pending_verification', 'Unverified'], ['suspended', 'Suspended']] as const).map(([v, l]) => (
            <button key={v} onClick={() => changeStatus(v)}
              className={cn('px-3 py-1.5 rounded-md text-[11px] font-700 transition-colors',
                statusFilter === v ? 'bg-primary text-white' : 'text-text-secondary hover:text-text')}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Results, grouped by organisation */}
      {fetching && <Card padding="lg"><p className="text-sm text-text-muted text-center">Loading staff…</p></Card>}
      {error && !fetching && <Card padding="lg"><p className="text-sm text-danger text-center">{error}</p></Card>}
      {!fetching && !error && rows.length === 0 && (
        <Card padding="lg">
          <p className="text-sm text-text-muted text-center">
            {total === 0 && !debounced && !org && roleFilter === 'all' && statusFilter === 'all'
              ? 'No staff yet. They appear here once an organisation adds them.'
              : 'No staff match these filters.'}
          </p>
        </Card>
      )}

      {!fetching && !error && grouped.map((g) => (
        <Card key={g.orgId || 'none'} padding="none" className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-surface-2 border-b border-border">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="w-4 h-4 text-text-muted shrink-0" />
              {g.orgId ? (
                <Link href={`/organisations/${g.orgId}`}
                  className="text-sm font-800 text-text hover:text-primary transition-colors truncate">
                  {g.name}
                </Link>
              ) : <span className="text-sm font-800 text-text-muted">No organisation</span>}
            </div>
            <Badge variant="muted">{g.staff.length} on this page</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody>
                {g.staff.map((p) => {
                  const meta = ROLE_META[p.role] ?? ROLE_META.doctor;
                  const Icon = meta.icon;
                  return (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={p.name} size="sm" />
                          <div className="min-w-0">
                            <p className="font-700 text-text truncate">{p.name}</p>
                            <div className="flex items-center gap-2 text-[10px] text-text-muted">
                              {p.staffId && <span className="font-mono">{p.staffId}</span>}
                              {p.specialty && <span className="truncate">{p.specialty}</span>}
                              {!p.linked && <Badge variant="muted">Never logged in</Badge>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-text-secondary">
                          <Icon className="w-3.5 h-3.5" />{meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-text-secondary whitespace-nowrap">{p.phone || '—'}</td>
                      <td className="px-4 py-3"><StatusBadge p={p} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setModal({ type: 'view', provider: p })}
                            className="px-2.5 py-1 rounded-md border border-border text-[11px] font-700 text-text-secondary hover:bg-surface-2 transition-colors">
                            Details
                          </button>
                          {p.status === 'pending_verification' && (
                            <button onClick={() => setModal({ type: 'verify', provider: p })}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-white text-[11px] font-700 hover:bg-primary-hover transition-colors">
                              <ShieldCheck className="w-3 h-3" />Verify
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {/* Pagination */}
      {!fetching && !error && total > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-text-secondary">
            Showing <strong className="text-text">{firstOnPage.toLocaleString()}–{lastOnPage.toLocaleString()}</strong>{' '}
            of <strong className="text-text">{total.toLocaleString()}</strong>
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs font-700 text-text-secondary hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />Previous
            </button>
            <span className="text-xs font-700 text-text-secondary px-2">
              Page {page} of {totalPages}
            </span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs font-700 text-text-secondary hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Next<ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Detail */}
      <Modal
        open={modal?.type === 'view'}
        onClose={() => setModal(null)}
        title={modal?.type === 'view' ? modal.provider.name : ''}
        size="lg"
      >
        {modal?.type === 'view' && (() => {
          const p = modal.provider;
          const meta = ROLE_META[p.role] ?? ROLE_META.doctor;
          return (
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <Avatar name={p.name} size="xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-800 text-text">{p.name}</h3>
                    <StatusBadge p={p} />
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    {meta.label}{p.specialty ? ` · ${p.specialty}` : ''}
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap text-[11px] text-text-secondary">
                    {p.phone && <span className="inline-flex items-center gap-1 font-mono"><Phone className="w-3 h-3" />{p.phone}</span>}
                    {p.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{p.email}</span>}
                    {p.rating > 0 && <span className="inline-flex items-center gap-1"><Star className="w-3 h-3 text-warning" />{p.rating.toFixed(1)}</span>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-surface-2">
                <Field label="Staff ID" value={p.staffId ? <span className="font-mono">{p.staffId}</span> : '—'} />
                <Field label="Role" value={meta.label} />
                <Field label="Department" value={p.department} />
                <Field label="Shift" value={p.shift} />
                <Field label="Specialty" value={p.specialty} />
                <Field label="Login phone" value={p.phone ? <span className="font-mono">{p.phone}</span> : '—'} />
                <Field label="Joined" value={p.joinedAt ? new Date(p.joinedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} />
                <Field label="Verified" value={p.verifiedAt ? new Date(p.verifiedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not verified'} />
                <Field label="Has logged in" value={p.linked ? 'Yes' : 'No — account not claimed yet'} />
              </div>

              <div className="p-4 rounded-xl border border-border">
                <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider mb-2">Organisation</p>
                {p.orgId ? (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="w-4 h-4 text-text-muted shrink-0" />
                      <span className="text-sm font-700 text-text truncate">{p.orgName}</span>
                      {p.orgType && <Badge variant="muted" className="capitalize">{p.orgType}</Badge>}
                      {p.orgStatus && p.orgStatus !== 'active' && (
                        <Badge variant="danger" dot>{p.orgStatus}</Badge>
                      )}
                    </div>
                    <Link href={`/organisations/${p.orgId}`}
                      className="inline-flex items-center gap-1 text-[11px] font-700 text-primary hover:underline">
                      Open organisation <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                ) : <p className="text-xs text-text-muted">Not attached to an organisation.</p>}
                {p.orgStatus && p.orgStatus !== 'active' && (
                  <p className="text-[11px] text-danger mt-2">
                    Their organisation is {p.orgStatus}, so this person cannot log in
                    regardless of their own status.
                  </p>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      <ConfirmModal
        open={modal?.type === 'verify'}
        onClose={() => setModal(null)}
        onConfirm={handleVerify}
        title="Verify this staff member?"
        message={modal?.type === 'verify'
          ? `${modal.provider.name} will be marked verified and able to work on the platform.`
          : ''}
        confirmLabel="Verify"
        confirmVariant="primary"
        loading={loading}
      />
    </div>
  );
}
